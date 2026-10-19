import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FakeSupabase, UNICOS_REAIS } from '../stubs/fake-supabase';

// Simulação local da rota e do adapter reais. Nenhum socket ou credencial real.
const ORDER='77777777-7777-4777-8777-777777777777';
const SECRET='somente-fixture-local-infinitepay';
const effects=vi.hoisted(()=>({dispatch:vi.fn(),register:vi.fn(),sale:vi.fn(),buyer:vi.fn(),operational:vi.fn()}));
let fake:FakeSupabase;
let gateway:Record<string,unknown>;
let calls:number;
vi.mock('@/lib/supabase/server',()=>({createAdminClient:()=>fake}));
vi.mock('@/lib/tracking/despachar',()=>({despacharPurchase:effects.dispatch}));
vi.mock('@/lib/tracking/purchase',()=>({registrarPurchasePendente:effects.register}));
vi.mock('@/lib/notificacoes/venda-paga',()=>({avisarVendaPaga:effects.sale}));
vi.mock('@/lib/notificacoes/confirmacao-cliente',()=>({enviarConfirmacaoAoCliente:effects.buyer}));
vi.mock('@/lib/notificacoes/email-operacional',()=>({enviarEmailOperacional:effects.operational}));

beforeEach(()=>{
  vi.clearAllMocks();calls=0;
  vi.stubEnv('PAYMENT_PROVIDER','infinitepay');vi.stubEnv('REVERA_PAYMENT_PROVIDER','infinitepay');
  vi.stubEnv('PAYMENT_WEBHOOK_SECRET',SECRET);vi.stubEnv('INFINITEPAY_HANDLE','fixture-local');
  vi.stubEnv('PAYPAL_CLIENT_ID','');vi.stubEnv('PAYPAL_CLIENT_SECRET','');vi.stubEnv('PAYPAL_WEBHOOK_ID','');
  vi.spyOn(console,'error').mockImplementation(()=>{});
  gateway={success:true,paid:true,paid_amount:29700,capture_method:'pix'};
  vi.stubGlobal('fetch',vi.fn(async (url:unknown,options?:RequestInit)=>{
    // Qualquer tentativa de Meta, e-mail ou outro gateway falha antes da rede.
    expect(String(url)).toBe('https://api.checkout.infinitepay.io/payment_check');
    expect(options?.method).toBe('POST');
    expect(JSON.parse(String(options?.body))).toMatchObject({handle:'fixture-local',order_nsu:ORDER,transaction_nsu:'fixture-tx',slug:'fixture-invoice'});
    calls++;
    return Response.json(gateway);
  }));
  fake=new FakeSupabase({orders:[{id:ORDER,status:'new',payment_status:'pending',currency:'BRL',total_cents:29700}],payments:[{id:'fixture-payment',order_id:ORDER,provider:'infinitepay',provider_payment_id:'fixture-invoice',status:'pending',amount_cents:29700,raw_response:{checkout_url:'https://example.test/checkout'}}],payment_events:[],pixel_event_log:[],order_notifications:[],audit_logs:[]},UNICOS_REAIS);
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.restoreAllMocks();});
async function post(secret=createHash('sha256').update(SECRET).digest('hex')){
  const {POST}=await import('@/app/api/webhooks/pagamento/[segredo]/route');
  return POST(new Request('http://localhost/webhook/fixture',{method:'POST',body:JSON.stringify({order_nsu:ORDER,transaction_nsu:'fixture-tx',invoice_slug:'fixture-invoice',paid:true,paid_amount:29700})}),{params:Promise.resolve({segredo:secret})});
}
function noEffects(){expect(effects.register).not.toHaveBeenCalled();expect(effects.dispatch).not.toHaveBeenCalled();expect(effects.sale).not.toHaveBeenCalled();expect(effects.buyer).not.toHaveBeenCalled();}
describe('InfinitePay — webhook isolado, confirmação e replay',()=>{
  it('segredo errado não consulta gateway nem grava evento',async()=>{expect((await post('incorreto')).status).toBe(404);expect(calls).toBe(0);expect(fake.tabela('payment_events')).toHaveLength(0);noEffects();});
  it('paid=true no aviso não aprova quando a consulta informa não pago',async()=>{gateway={success:true,paid:false};expect((await post()).status).toBe(200);expect(calls).toBe(1);expect(fake.tabela('orders')[0]?.payment_status).toBe('pending');noEffects();});
  it('consulta inconclusiva mantém pedido e libera evento para reenvio',async()=>{gateway={success:false};expect((await post()).status).toBe(400);expect(fake.tabela('payment_events')).toHaveLength(0);expect(fake.tabela('orders')[0]?.payment_status).toBe('pending');noEffects();});
  it('valor insuficiente na consulta não libera pedido nem conversão',async()=>{gateway={success:true,paid:true,paid_amount:100};expect((await post()).status).toBe(200);expect(fake.tabela('orders')[0]?.payment_status).toBe('pending');noEffects();});
  it('aprovação local seguida de replay aplica efeitos uma única vez',async()=>{expect((await post()).status).toBe(200);expect((await post()).status).toBe(200);expect(fake.tabela('orders')[0]?.payment_status).toBe('paid');expect(fake.tabela('payment_events')).toHaveLength(1);expect(calls).toBe(1);for(const f of [effects.register,effects.dispatch,effects.sale,effects.buyer])expect(f).toHaveBeenCalledTimes(1);});
  it('recuperação após consulta inconclusiva aprova uma vez e rejeita replay',async()=>{gateway={success:false};expect((await post()).status).toBe(400);gateway={success:true,paid:true,paid_amount:29700};expect((await post()).status).toBe(200);expect((await post()).status).toBe(200);expect(calls).toBe(2);expect(fake.tabela('payment_events')).toHaveLength(1);expect(effects.dispatch).toHaveBeenCalledTimes(1);});
});
