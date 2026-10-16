import { beforeEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
vi.mock("react", async (original) => ({ ...await original<typeof import("react")>(), cache: (fn: unknown) => fn }));
const mock = vi.hoisted(() => ({ order: null as any, country: 'DE', from: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createAdminClient: () => ({ from: mock.from }) }));
import { idiomaDoLayoutDoPedido } from '@/lib/i18n/pedido-layout';
const token = '97efb742-f783-487e-8b12-c59f7428a68f';
beforeEach(() => {
 mock.order = {locale:'es',address_id:'address'}; mock.country='DE'; mock.from.mockReset();
 mock.from.mockImplementation((table:string) => { const q = { select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='orders'?mock.order:{country:mock.country}}) }; return q; });
});
for(const locale of ['es','fr','de'] as const) it(`pedido ${locale} prevalece sobre cookie inglês`, async()=>{
 mock.order.locale=locale;
 expect(await idiomaDoLayoutDoPedido(token,'en')).toBe(locale);
 expect(mock.from).toHaveBeenCalledTimes(1);
});
it('pedido antigo segue país, não cookie',async()=>{mock.order.locale=null;expect(await idiomaDoLayoutDoPedido(token,'en')).toBe('de');});
it('pedido antigo sem endereço segue português',async()=>{mock.order={locale:null,address_id:null};expect(await idiomaDoLayoutDoPedido(token,'en')).toBe('pt');});
it('pedido inexistente mantém idioma do site',async()=>{mock.order=null;expect(await idiomaDoLayoutDoPedido(token,'fr')).toBe('fr');});
it('outras páginas e token inválido não consultam banco',async()=>{expect(await idiomaDoLayoutDoPedido(null,'fr')).toBe('fr');expect(await idiomaDoLayoutDoPedido('invalido','de')).toBe('de');expect(mock.from).not.toHaveBeenCalled();});
it('middleware extrai token da rota e ignora token forjado',()=>{
 const h='x-middleware-request-x-revera-pedido-token';
 expect(middleware(new NextRequest(`https://example.com/pedido/${token}`,{headers:{'x-revera-pedido-token':'forjado'}})).headers.get(h)).toBe(token);
 expect(middleware(new NextRequest('https://example.com/produtos',{headers:{'x-revera-pedido-token':token}})).headers.get(h)).toBe('');
});
