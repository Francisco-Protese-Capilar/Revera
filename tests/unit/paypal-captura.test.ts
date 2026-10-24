/**
 * reavaliarCapturaPayPal (06/10/2026): o que acontece com o pedido quando o
 * PayPal segura, recusa, reembolsa ou estorna. O estado vem do PayPal (stub);
 * o teste guarda que cada estado leva à ação certa — e que NENHUM deles marca
 * pedido como pago por fora de confirmarPagamento().
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "../stubs/fake-supabase";

const PEDIDO = "55555555-5555-4555-8555-555555555555";
const ORDEM = "PAYPAL-ORDER-9";

let fake: FakeSupabase;
let estado: unknown;
const confirmar = vi.fn();
const reembolsar = vi.fn();
const email = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createAdminClient: () => fake }));
vi.mock("@/lib/payments/confirmar", () => ({
  confirmarPagamento: (...a: unknown[]) => confirmar(...a),
  registrarReembolso: (...a: unknown[]) => reembolsar(...a),
}));
vi.mock("@/lib/notificacoes/email-operacional", () => ({
  enviarEmailOperacional: (...a: unknown[]) => email(...a),
}));
vi.mock("@/lib/payments/paypal-provider", () => ({
  PayPalProvider: class {
    async estadoCaptura(ordem: string, pedido: string, _opcoes?: unknown) {
      expect(ordem).toBe(ORDEM);
      expect(pedido).toBe(PEDIDO);
      if (estado instanceof Error) throw estado;
      return estado;
    }
  },
}));

function banco(paymentStatus = "pending", pagamentoStatus = "pending") {
  fake = new FakeSupabase({
    orders: [{ id: PEDIDO, order_number: "REV-T", payment_status: paymentStatus, canceled_at: null, currency: "EUR", total_cents: 23281, dispatch_hold_reason: null, dispatch_hold_at: null }],
    payments: [{ id: "pay-1", order_id: PEDIDO, provider: "paypal", status: pagamentoStatus, provider_payment_id: ORDEM, created_at: "2026-10-06T00:00:00Z" }],
  });
}

async function reavaliar(eventoGateway: string | null = null) {
  const { reavaliarCapturaPayPal } = await import("@/lib/payments/paypal-captura");
  return reavaliarCapturaPayPal(PEDIDO, { eventId: "WH-1", paypalOrderId: ORDEM, eventoGateway });
}

beforeEach(() => {
  vi.resetModules();
  confirmar.mockReset().mockResolvedValue({ estado: "pago", jaEstavaPago: false });
  reembolsar.mockReset().mockResolvedValue("reembolsado");
  email.mockReset().mockResolvedValue({ estado: "enviado" });
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("reavaliarCapturaPayPal", () => {
  it("captura concluída confirma pelo caminho de sempre", async () => {
    banco();
    estado = { estado: "concluida" };
    await expect(reavaliar()).resolves.toEqual({ estado: "confirmado", pago: true });
    expect(confirmar).toHaveBeenCalledWith(PEDIDO, expect.objectContaining({ transactionId: ORDEM }));
  });

  it("captura retida avisa a equipe com o motivo e não mexe no pedido", async () => {
    banco();
    estado = { estado: "pendente", motivo: "RECEIVING_PREFERENCE_MANDATES_MANUAL_ACTION" };
    await expect(reavaliar()).resolves.toMatchObject({ estado: "retido" });
    expect(confirmar).not.toHaveBeenCalled();
    expect(email).toHaveBeenCalledTimes(1);
    const msg = email.mock.calls[0]?.[0] as { texto: string; idempotencyKey: string };
    expect(msg.texto).toContain("aceite manual de moeda");
    expect(msg.idempotencyKey).toBe(`revera-paypal-retido:${PEDIDO}`);
    expect(fake.tabela("orders")[0]?.payment_status).toBe("pending");
  });

  it("captura recusada libera a reserva (failed) e avisa", async () => {
    banco();
    estado = { estado: "recusada", motivo: null };
    await expect(reavaliar()).resolves.toEqual({ estado: "recusado" });
    expect(fake.tabela("payments")[0]?.status).toBe("failed");
    expect(email).toHaveBeenCalledTimes(1);
  });

  it("recusa não rebaixa um pagamento já aprovado", async () => {
    banco("pending", "approved");
    estado = { estado: "recusada", motivo: null };
    await reavaliar();
    expect(fake.tabela("payments")[0]?.status).toBe("approved");
  });

  it("estorno/chargeback registra o reembolso e manda não despachar", async () => {
    banco("paid", "approved");
    estado = { estado: "estornada", motivo: "REVERSED" };
    await expect(reavaliar()).resolves.toEqual({ estado: "reembolsado" });
    expect(reembolsar).toHaveBeenCalledWith(PEDIDO, expect.objectContaining({ provider: "paypal", transactionId: ORDEM }));
    expect((email.mock.calls[0]?.[0] as { texto: string }).texto).toContain("NÃO DESPACHAR");
  });

  it("estorno de outra tentativa não mexe no pedido pago pela tentativa aprovada", async () => {
    fake = new FakeSupabase({
      orders: [{ id: PEDIDO, order_number: "REV-T", payment_status: "paid", canceled_at: null, currency: "EUR", total_cents: 23281, dispatch_hold_reason: null, dispatch_hold_at: null }],
      payments: [
        { id: "pay-ok", order_id: PEDIDO, provider: "paypal", status: "approved", provider_payment_id: "ORDEM-QUE-PAGOU", created_at: "2026-10-06T00:00:00Z" },
        { id: "pay-dup", order_id: PEDIDO, provider: "paypal", status: "failed", provider_payment_id: ORDEM, created_at: "2026-10-07T00:00:00Z" },
      ],
    });
    estado = { estado: "reembolsada" };
    await expect(reavaliar()).resolves.toMatchObject({ estado: "nada_a_fazer" });
    expect(reembolsar).not.toHaveBeenCalled();
    expect(fake.tabela("orders")[0]?.payment_status).toBe("paid");
    expect((email.mock.calls[0]?.[0] as { texto: string }).texto).toContain("NÃO foi alterado");
  });

  it("estorno da tentativa aprovada estorna o pedido mesmo havendo outras tentativas", async () => {
    fake = new FakeSupabase({
      orders: [{ id: PEDIDO, order_number: "REV-T", payment_status: "paid", canceled_at: null, currency: "EUR", total_cents: 23281, dispatch_hold_reason: null, dispatch_hold_at: null }],
      payments: [
        { id: "pay-ok", order_id: PEDIDO, provider: "paypal", status: "approved", provider_payment_id: ORDEM, created_at: "2026-10-06T00:00:00Z" },
        { id: "pay-dup", order_id: PEDIDO, provider: "paypal", status: "failed", provider_payment_id: "OUTRA", created_at: "2026-10-07T00:00:00Z" },
      ],
    });
    estado = { estado: "estornada" };
    await expect(reavaliar()).resolves.toEqual({ estado: "reembolsado" });
    expect(reembolsar).toHaveBeenCalled();
  });

  it("sem nenhuma tentativa aprovada (pedido antigo), o estorno continua valendo", async () => {
    banco("paid", "pending");
    estado = { estado: "reembolsada" };
    await expect(reavaliar()).resolves.toEqual({ estado: "reembolsado" });
    expect(reembolsar).toHaveBeenCalled();
  });

  it("reembolso parcial só avisa, não estorna o pedido", async () => {
    banco("paid", "approved");
    estado = { estado: "parcialmente_reembolsada" };
    await expect(reavaliar()).resolves.toEqual({ estado: "parcial" });
    expect(reembolsar).not.toHaveBeenCalled();
  });

  it("PayPal fora do ar devolve indisponível (o webhook é reenviado)", async () => {
    banco();
    estado = new Error("timeout");
    await expect(reavaliar()).resolves.toMatchObject({ estado: "indisponivel" });
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("pedido sem ordem PayPal não consulta nada", async () => {
    fake = new FakeSupabase({
      orders: [{ id: PEDIDO, order_number: "REV-T", payment_status: "pending", canceled_at: null, currency: "EUR", total_cents: 1 }],
      payments: [],
    });
    estado = { estado: "concluida" };
    await expect(reavaliar()).resolves.toEqual({ estado: "sem_paypal" });
  });

  it("aviso de chargeback com captura ainda concluída: trava o despacho, avisa e não estorna", async () => {
    banco("paid", "approved");
    estado = { estado: "concluida" };
    await expect(reavaliar("PAYMENT.CAPTURE.REVERSED")).resolves.toMatchObject({ estado: "nada_a_fazer" });
    expect(reembolsar).not.toHaveBeenCalled();
    const pedido = fake.tabela("orders")[0];
    expect(pedido?.payment_status).toBe("paid");
    expect(pedido?.dispatch_hold_reason).toBe("paypal_aviso_estorno");
    expect(pedido?.dispatch_hold_at).toEqual(expect.any(String));
    expect(email).toHaveBeenCalledTimes(1);
    expect((email.mock.calls[0]?.[0] as { texto: string }).texto).toContain("DESPACHO FOI TRAVADO");
  });

  it("aviso de estorno repetido não regrava a trava nem o horário", async () => {
    banco("paid", "approved");
    fake.tabela("orders")[0]!.dispatch_hold_reason = "paypal_aviso_estorno";
    fake.tabela("orders")[0]!.dispatch_hold_at = "2026-10-20T00:00:00Z";
    estado = { estado: "concluida" };
    await reavaliar("PAYMENT.CAPTURE.REFUNDED");
    expect(fake.tabela("orders")[0]?.dispatch_hold_at).toBe("2026-10-20T00:00:00Z");
  });

  it("se a trava não grava, devolve indisponível para o PayPal reenviar (e não manda e-mail)", async () => {
    banco("paid", "approved");
    fake.falharProxima("orders", "update");
    estado = { estado: "concluida" };
    await expect(reavaliar("PAYMENT.CAPTURE.REVERSED")).resolves.toMatchObject({ estado: "indisponivel" });
    expect(email).not.toHaveBeenCalled();
  });

  it("estorno que o banco não consegue gravar devolve indisponível (não 'reembolsado')", async () => {
    banco("paid", "approved");
    reembolsar.mockResolvedValue("indisponivel");
    estado = { estado: "reembolsada" };
    await expect(reavaliar()).resolves.toMatchObject({ estado: "indisponivel" });
    expect(email).not.toHaveBeenCalled();
  });

  it("recusa de uma ordem num pedido já pago não muda nada nem avisa", async () => {
    banco("paid", "pending");
    estado = { estado: "recusada", motivo: null };
    await expect(reavaliar()).resolves.toMatchObject({ estado: "nada_a_fazer" });
    expect(fake.tabela("payments")[0]?.status).toBe("pending");
    expect(email).not.toHaveBeenCalled();
  });

  it("status desconhecido só avisa", async () => {
    banco("paid", "approved");
    estado = { estado: "desconhecida", status: "NOVO_STATUS" };
    await expect(reavaliar()).resolves.toMatchObject({ estado: "nada_a_fazer" });
    expect(reembolsar).not.toHaveBeenCalled();
    expect(email).toHaveBeenCalledTimes(1);
  });

  it("captura retida fica marcada UMA vez no histórico (fila longa da conferência)", async () => {
    banco();
    estado = { estado: "pendente", motivo: "RECEIVING_PREFERENCE_MANDATES_MANUAL_ACTION" };
    await reavaliar();
    await reavaliar();
    const marcas = fake.tabela("audit_logs").filter((l) => l.action === "pedido.paypal_retido");
    expect(marcas).toHaveLength(1);
    expect(marcas[0]).toMatchObject({ entity_type: "orders", entity_id: PEDIDO });
    expect(marcas[0]?.diff).toMatchObject({ ordem: ORDEM, motivo: "RECEIVING_PREFERENCE_MANDATES_MANUAL_ACTION" });
  });

  it("captura concluída não marca retido", async () => {
    banco();
    estado = { estado: "concluida" };
    await reavaliar();
    expect(fake.tabela("audit_logs")).toHaveLength(0);
  });
});
