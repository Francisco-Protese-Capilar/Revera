import type { Metadata } from "next";
import { renderCheckout } from "./renderizar-checkout";

export const metadata: Metadata = {
  title: "Checkout",
};


/**
 * A casca da página (ver renderizar-checkout.tsx) decide QUAL checkout renderizar:
 *
 *  - Brasil (padrão e único caso enquanto CHECKOUT_PAISES não abrir mais
 *    países): o CheckoutForm de sempre, intocado.
 *  - País internacional ABERTO (env + Stripe): o formulário internacional;
 *    o subtotal e a cotação DHL serão mostrados antes de criar um pedido.
 *  - País internacional sem gateway disponível: mensagem honesta de
 *    indisponibilidade — a tarifa DHL depende do endereço informado.
 *
 * O seletor de país só aparece quando existe mais de um país aberto —
 * a loja 100% nacional não ganha UI nova nenhuma.
 */
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ pais?: string }>;
}) {
  const sp = await searchParams;
  return renderCheckout({ localeDaRota: null, paisExplicito: sp.pais });
}

