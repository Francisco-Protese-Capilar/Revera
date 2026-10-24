/**
 * Etiqueta nacional × trava de despacho (24/10/2026, revisão Codex no #37).
 *
 * O aviso de estorno pode chegar depois que a emissão já travou o pedido em
 * 'label_processing'. O gatilho do banco só barra o 'label_created', depois
 * da etiqueta comprada. Por isso a emissão relê a trava logo antes de pagar,
 * e não declara sucesso se o pedido não conseguiu andar.
 *
 * O cenário usa a retomada (etiqueta criada, não paga), que é o caminho mais
 * curto até o pagamento.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "../stubs/fake-supabase";

const PEDIDO = "66666666-6666-4666-8666-666666666666";
let fake: FakeSupabase;
const pagar = vi.fn();
const auditoria = vi.fn();

vi.mock("@/lib/supabase/server", () => ({ createClient: async () => fake }));
vi.mock("@/lib/admin/audit", () => ({ registrarAuditoria: (...a: unknown[]) => auditoria(...a) }));
vi.mock("next/cache", () => ({ revalidatePath: () => {} }));
vi.mock("@/lib/shipping", () => ({
  ShippingUnavailable: class extends Error {},
  getShippingProvider: () => ({
    payLabel: (...a: unknown[]) => pagar(...a),
    getShipmentStatus: async () => ({ trackingCode: "BR123", status: "released" }),
    getLabelUrl: async () => "https://etiqueta/pdf",
    createLabel: async () => {
      throw new Error("não deveria criar etiqueta nova na retomada");
    },
  }),
}));

function banco(trava: string | null) {
  fake = new FakeSupabase({
    orders: [{
      id: PEDIDO, order_number: "REV-N", payment_status: "paid", shipping_status: "shipping_error",
      subtotal_cents: 65000, shipping_cents: 3000, customer_id: "c1", address_id: "a1",
      dispatch_hold_reason: trava,
    }],
    addresses: [{ id: "a1", country: "BR" }],
    shipments: [{ id: "s1", order_id: PEDIDO, provider_shipment_id: "SF-1", tracking_code: null, label_url: null }],
  });
}

async function gerar() {
  const { gerarEtiquetaAction } = await import("@/app/admin/(protected)/pedidos/etiqueta");
  return gerarEtiquetaAction({ orderId: PEDIDO });
}

beforeEach(() => {
  vi.resetModules();
  pagar.mockReset().mockResolvedValue(undefined);
  auditoria.mockReset();
});

describe("etiqueta nacional e trava de despacho", () => {
  it("sem trava, paga e conclui como sempre", async () => {
    banco(null);
    await expect(gerar()).resolves.toMatchObject({ ok: true, rastreio: "BR123" });
    expect(pagar).toHaveBeenCalledWith("SF-1");
    expect(fake.tabela("orders")[0]?.shipping_status).toBe("label_created");
  });

  it("trava presente na hora de pagar: não paga e devolve o pedido para erro de envio", async () => {
    banco("paypal_aviso_estorno");
    const r = await gerar();
    expect(r).toMatchObject({ error: expect.stringContaining("Despacho travado") });
    expect(pagar).not.toHaveBeenCalled();
    expect(fake.tabela("orders")[0]?.shipping_status).toBe("shipping_error");
  });

  it("etiqueta paga mas pedido não anda: não declara sucesso e registra no histórico", async () => {
    banco(null);
    // A trava (ou outra mudança) chega entre o pagamento e a conclusão.
    pagar.mockImplementation(async () => { fake.falharProxima("orders", "update"); });
    const r = await gerar();
    expect(r).toMatchObject({ error: expect.stringContaining("foi paga") });
    expect(auditoria).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: "pedido.etiqueta_paga_sem_concluir" }));
  });
});
