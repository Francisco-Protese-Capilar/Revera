import type { Dicionario } from "./idioma";

/** Apenas apresentação: não altera o estado nem a confirmação de pagamento. */
export function cabecalhoDoPedido(
  t: Dicionario,
  estado: { cancelado: boolean; estornado: boolean; pago: boolean; emConfirmacao: boolean }
) {
  if (estado.cancelado) return {
    titulo: t.pedidoCanceladoTitulo,
    descricao: estado.estornado ? t.pedidoTextoEstornado : t.pedidoCancelado,
  };
  if (estado.estornado) return { titulo: t.pedidoEstornado, descricao: t.pedidoTextoEstornado };
  if (estado.pago) return { titulo: t.pedidoPago, descricao: t.pedidoTextoPago };
  if (estado.emConfirmacao) return { titulo: t.pedidoEmConfirmacao, descricao: t.pedidoTextoEmConfirmacao };
  return { titulo: t.pedidoAguardando, descricao: t.pedidoTextoAguardando };
}
