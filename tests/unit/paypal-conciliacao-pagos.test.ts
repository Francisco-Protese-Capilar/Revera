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
/** Marcadores gravados pelo cron, guardados entre rodadas como no banco. */
let marcadores: Array<{ action: string; diff: unknown }> = [];

function construtor(tabela: string) {
  const chamadas: Chamada[] = [];
  consultas.push({ tabela, chamadas });
  const proxy: Record<string, unknown> = {};
  for (const metodo of ["select", "eq", "neq", "or", "not", "is", "gte", "lte", "in", "order", "limit", "range"]) {
    proxy[metodo] = (...args: unknown[]) => { chamadas.push({ metodo, args }); return proxy; };
  }
  proxy.insert = (linha: { action: string; diff: unknown }) => { marcadores.push(linha); return Promise.resolve({ error: null }); };
  proxy.maybeSingle = () => {
    if (tabela === "audit_logs" && tem(chamadas, "eq", "action", "cron.paypal_pagos_cursor")) {
      return Promise.resolve({ data: marcadores.at(-1) ?? null, error: null });
    }
    return Promise.resolve({ data: null, error: null });
  };
  proxy.then = (ok: (v: unknown) => unknown) => {
    let linhas = respostas(tabela, chamadas) as Array<Record<string, unknown>>;
    // Busca a partir do cursor: or(created_at.gt."X",and(created_at.eq."X",id.gt.Y))
    const ou = chamadas.find((c) => c.metodo === "or")?.args[0] as string | undefined;
    const m = ou?.match(/created_at\.gt\."([^"]+)".*id\.gt\.([^)]+)\)/);
    if (m) {
      const [, ts, id] = m;
      linhas = linhas.filter((l) => (l.created_at as string) > ts! || ((l.created_at as string) === ts && (l.id as string) > id!));
    }
    const lim = chamadas.find((c) => c.metodo === "limit")?.args[0] as number | undefined;
    return ok({ data: lim === undefined ? linhas : linhas.slice(0, lim), error: null });
  };
  return proxy;
}

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => ({ from: (t: string) => construtor(t) }) }));
const reavaliar = vi.fn();
vi.mock("@/lib/payments/paypal-captura", () => ({
  ACAO_PAYPAL_RETIDO: "pedido.paypal_retido",
  reavaliarCapturaPayPal: (...a: unknown[]) => reavaliar(...a),
}));
vi.mock("@/lib/payments/paypal-provider", () => ({ PayPalProvider: class {} }));

const pago = (i: number) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  created_at: new Date(Date.UTC(2026, 9, 1) + i * 1000).toISOString(),
  order_id: `pago-${i}`,
  provider_payment_id: `O-${i}`,
});

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
  marcadores = [];
  process.env.CRON_SECRET = "segredo-cron";
  reavaliar.mockReset().mockResolvedValue({ estado: "nada_a_fazer", detalhe: "pedido paid" });
  respostas = (tabela, chamadas) => {
    if (tabela !== "payments") return [];
    if (tem(chamadas, "eq", "orders.payment_status", "paid")) {
      return [{ ...pago(1), provider_payment_id: "ORDEM-APROVADA" }];
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

  it("no máximo 10 pagos por rodada, em ordem fixa do mais antigo para o mais novo", async () => {
    respostas = (tabela, chamadas) =>
      tabela === "payments" && tem(chamadas, "eq", "orders.payment_status", "paid")
        ? Array.from({ length: 30 }, (_, i) => pago(i))
        : [];
    await rodar();
    expect(reavaliar).toHaveBeenCalledTimes(10);
    const pagos = consultas.find((q) => q.tabela === "payments" && tem(q.chamadas, "eq", "orders.payment_status", "paid"));
    expect(tem(pagos!.chamadas, "order", "created_at", { ascending: true })).toBe(true);
    expect(tem(pagos!.chamadas, "order", "id", { ascending: true })).toBe(true);
  });

  it("rodízio: com mais de 100 elegíveis, todos são conferidos em rodadas seguidas", async () => {
    const N = 137;
    respostas = (tabela, chamadas) =>
      tabela === "payments" && tem(chamadas, "eq", "orders.payment_status", "paid")
        ? Array.from({ length: N }, (_, i) => pago(i))
        : [];
    const vistos = new Set<string>();
    for (let r = 0; r < Math.ceil(N / 10); r++) {
      reavaliar.mockClear();
      vi.resetModules();
      await rodar();
      for (const c of reavaliar.mock.calls) vistos.add(c[0] as string);
    }
    expect(vistos.size).toBe(N);
  });

  it("pagos que saem da lista entre rodadas não fazem o cursor pular ninguém", async () => {
    // 30 elegíveis; depois da 1ª rodada, os 10 conferidos são estornados e
    // saem da lista. A 2ª rodada tem de começar exatamente no 11º.
    let saidos = new Set<string>();
    respostas = (tabela, chamadas) =>
      tabela === "payments" && tem(chamadas, "eq", "orders.payment_status", "paid")
        ? Array.from({ length: 30 }, (_, i) => pago(i)).filter((l) => !saidos.has(l.order_id))
        : [];
    await rodar();
    const primeira = reavaliar.mock.calls.map((c) => c[0] as string);
    expect(primeira).toEqual(Array.from({ length: 10 }, (_, i) => `pago-${i}`));
    saidos = new Set(primeira);
    reavaliar.mockClear();
    vi.resetModules();
    await rodar();
    expect(reavaliar.mock.calls.map((c) => c[0] as string)).toEqual(Array.from({ length: 10 }, (_, i) => `pago-${i + 10}`));
  });

  it("orçamento esgotado no meio: a próxima rodada continua de onde parou, sem pular ninguém", async () => {
    // 10 pagos e 8 vendas pendentes; cada conferência gasta 6 s. Em 45 s
    // cabem poucas, e as vendas têm teto de 30 s: os pagos ainda andam.
    respostas = (tabela, chamadas) => {
      if (tabela !== "payments") return [];
      if (tem(chamadas, "eq", "orders.payment_status", "paid")) {
        return Array.from({ length: 10 }, (_, i) => pago(i));
      }
      return Array.from({ length: 8 }, (_, i) => ({ order_id: `pend-${i}`, provider_payment_id: `P-${i}` }));
    };
    let relogio = Date.UTC(2026, 9, 24, 12, 0, 0);
    const agoraReal = Date.now;
    Date.now = () => relogio;
    reavaliar.mockImplementation(async () => { relogio += 6_000; return { estado: "nada_a_fazer", detalhe: "x" }; });
    const pagosVistos = new Set<string>();
    try {
      for (let r = 0; r < 8; r++) {
        reavaliar.mockClear();
        vi.resetModules();
        await rodar();
        const nestaRodada = reavaliar.mock.calls.map((c) => c[0] as string).filter((id) => id.startsWith("pago-"));
        expect(nestaRodada.length).toBeGreaterThan(0); // tempo reservado aos pagos
        nestaRodada.forEach((id) => pagosVistos.add(id));
        relogio += 15 * 60_000;
      }
    } finally {
      Date.now = agoraReal;
    }
    expect(pagosVistos.size).toBe(10);
  });
});
