import { renderCheckout } from "./renderizar-checkout";
import type { SiteLocale } from "@/lib/i18n/site";

/**
 * Entrada interna das rotas localizadas (`/en/checkout`, `/fr/checkout`...).
 *
 * O idioma da rota é só tradução. O país de entrega é resolvido pela mesma
 * precedência da rota sem prefixo (`?pais=` → escolha da jornada →
 * geolocalização), com o mercado padrão do idioma apenas como último recurso
 * — ver src/lib/internacional/destino.ts.
 */
export async function checkoutLocalizado(localeDaRota: SiteLocale, paisExplicito: string | undefined) {
  return renderCheckout({ localeDaRota, paisExplicito });
}
