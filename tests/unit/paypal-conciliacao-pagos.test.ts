/**
 * Conferência periódica PayPal × pedidos pagos ainda não enviados (24/10/2026).
 *
 * Antes, o cron só olhava pedidos 'pending': um estorno cujo aviso se perdeu
 * deixava o pedido 'paid' e despachável para sempre (achado do Codex, 08/10).
 * Este teste guarda que os pagos não enviados entram na fila, com a ordem do
 * pagamento APROVADO, e que enviados/entregues ficam de fora pelo filtro.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

type Chamada = { metodo: string; args: unknown[] };
const consultas: Array<{ tabela: string; chamadas: Chamada[] }> = [];
let respostas: (tabela: string, chamadas: Chamada[]) => unknown[];

function construtor(tabela: string) {
  const chamadas: Chamada[] = [];
  consultas.push({ tabela, chamadas });
  const proxy: Record<string, unknown> = {};
  for (const metodo of ["select", "eq", "neq", "or", "not", "is", "gte", "lte", "in", "order", "limit"]) {
    proxy[metodo] = (...args: unknown[]) => { chamadas.push({ metodo, args }); return proxy; };
  }
  proxy.then = (ok: (v: unknown) => unknown) => ok({ data: respostas(tabela, chamadas), error: null });
  return proxy;
}

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => ({ from: (t: string) => construtor(t) }) }));
const reavaliar = vi.fn();
vi.mock("@/lib/payments/paypal-captura", () => ({
  ACAO_PAYPAL_RETIDO: "pedido.paypal_retido",
  reavaliarCapturaPayPal: (...a: unknown[]) => reavaliar(...a),
}));
vi.mock("@/lib/payments/paypal-provider", () => ({ PayPalProvider: class {} }));

const tem = (c: Chamada[], metodo: string, ...args: unknown[]) =>
  c.some((x) => x.metodo === metodo && JSON.stringify(x.args) === JSON.stringify(args));

async function rodar() {
  const { GET } = await import("@/app/api/cron/paypal-conciliacao/route");
  return GET(new Request("http://local/api/cron/paypal-conciliacao", {
    headers: { authorization: "Bearer segredo-cron" },
  }) as never);
}

beforeEach(() => {
  vi.resetModules();
  consultas.length = 0;
  process.env.CRON_SECRET = "segredo-cron";
  reavaliar.mockReset().mockResolvedValue({ estado: "nada_a_fazer", detalhe: "pedido paid" });
  respostas = (tabela, chamadas) => {
    if (tabela !== "payments") return [];
    if (tem(chamadas, "eq", "orders.payment_status", "paid")) {
      return [{ order_id: "pago-1", provider_payment_id: "ORDEM-APROVADA" }];
    }
    return [{ order_id: "pendente-1", provider_payment_id: "ORDEM-PENDENTE" }];
  };
});

describe("cron PayPal: pedidos pagos ainda não enviados", () => {
  it("reconfere o pago não enviado com a ordem do pagamento aprovado, depois dos pendentes", async () => {
    const r = await rodar();
    expect(r.status).toBe(200);
    expect(reavaliar.mock.calls.map((c) => [c[0], (c[1] as { paypalOrderId: string }).paypalOrderId])).toEqual([
      ["pendente-1", "ORDEM-PENDENTE"],
      ["pago-1", "ORDEM-APROVADA"],
    ]);
  });

  it("a consulta dos pagos só pega PayPal aprovado, não cancelado, internacional e ainda não enviado", async () => {
    await rodar();
    const pagos = consultas.find((q) => q.tabela === "payments" && tem(q.chamadas, "eq", "orders.payment_status", "paid"));
    expect(pagos).toBeDefined();
    const c = pagos!.chamadas;
    expect(tem(c, "eq", "provider", "paypal")).toBe(true);
    expect(tem(c, "eq", "status", "approved")).toBe(true);
    expect(tem(c, "is", "orders.canceled_at", null)).toBe(true);
    expect(tem(c, "neq", "orders.currency", "BRL")).toBe(true);
    expect(tem(c, "not", "orders.shipping_status", "in", "(shipped,delivered)")).toBe(true);
    expect(c.some((x) => x.metodo === "gte" && x.args[0] === "orders.created_at")).toBe(true);
  });

  it("no máximo 10 pagos por rodada", async () => {
    respostas = (tabela, chamadas) =>
      tabela === "payments" && tem(chamadas, "eq", "orders.payment_status", "paid")
        ? Array.from({ length: 30 }, (_, i) => ({ order_id: `pago-${i}`, provider_payment_id: `O-${i}` }))
        : [];
    await rodar();
    expect(reavaliar).toHaveBeenCalledTimes(10);
  });
});
