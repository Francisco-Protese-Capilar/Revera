import { describe, expect, it } from "vitest";
import { textos, type Idioma } from "@/lib/internacional/idioma";
import { cabecalhoDoPedido } from "@/lib/internacional/pedido-cabecalho";
const titulos: Record<Idioma, string> = { pt: "Pedido cancelado", en: "Order cancelled", es: "Pedido cancelado", fr: "Commande annulée", de: "Bestellung storniert" };
const base = { cancelado: false, estornado: false, pago: false, emConfirmacao: false };
for (const idioma of Object.keys(titulos) as Idioma[]) describe(idioma, () => {
  const t = textos(idioma);
  it("pedido cancelado não promete aguardar confirmação de pagamento", () => {
    const h = cabecalhoDoPedido(t, { ...base, cancelado: true });
    expect(h).toEqual({ titulo: titulos[idioma], descricao: t.pedidoCancelado });
    expect(h.descricao).not.toBe(t.pedidoTextoAguardando);
  });
  it("preserva a informação do estorno quando o pedido também foi cancelado", () => {
    expect(cabecalhoDoPedido(t, { ...base, cancelado: true, estornado: true })).toEqual({ titulo: titulos[idioma], descricao: t.pedidoTextoEstornado });
  });
  it("preserva os outros estados de pagamento", () => {
    expect(cabecalhoDoPedido(t, base)).toEqual({ titulo: t.pedidoAguardando, descricao: t.pedidoTextoAguardando });
    expect(cabecalhoDoPedido(t, { ...base, pago: true }).titulo).toBe(t.pedidoPago);
    expect(cabecalhoDoPedido(t, { ...base, estornado: true }).titulo).toBe(t.pedidoEstornado);
    expect(cabecalhoDoPedido(t, { ...base, emConfirmacao: true }).titulo).toBe(t.pedidoEmConfirmacao);
  });
});
