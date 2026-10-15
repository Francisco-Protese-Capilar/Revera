import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CarrinhoPageClient } from "./CarrinhoPageClient";
import { mercadoDaVitrine } from "@/lib/internacional/destino-server";

// Server Component só pela metadata — o conteúdo em si é 100% client
// (CarrinhoPageClient usa useCart(), o mesmo estado do drawer e do Header,
// ver src/components/cart/CartProvider.tsx). Não há leitura própria de
// Supabase aqui: duplicar a leitura entre server e client só para o
// primeiro render criaria duas fontes de verdade momentâneas (a do SSR e a
// do Provider, que sempre recarrega no mount) — melhor uma só.
export const metadata: Metadata = {
  title: "Sua sacola",
};

export default async function CarrinhoPage() {
  // A sacola nacional mostra preços BRL e a escada de desconto. Entrega fora
  // do Brasil lida em português (Portugal, ou destino escolhido na jornada)
  // vai direto ao resumo precificado no servidor, como na rota localizada.
  const mercado = await mercadoDaVitrine("pt");
  if (!mercado.nacional) redirect("/checkout");
  return <CarrinhoPageClient />;
}
