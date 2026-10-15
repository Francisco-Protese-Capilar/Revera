import "server-only";
import { cookies, headers } from "next/headers";
import { GEO_COUNTRY_COOKIE, GEO_COUNTRY_HEADER, type SiteLocale } from "@/lib/i18n/site";
import { paisesDoCheckout, regraDoPais, type RegraDePais } from "./paises";
import { PAIS_ESCOLHIDO_COOKIE, destinoDaVitrine } from "./destino";

export interface MercadoDaVitrine {
  /** Regra do país de entrega resolvido (moeda, locale de número/data). */
  regra: RegraDePais;
  /** Brasil: preço nacional em BRL, sem PTAX nem variant_prices. */
  nacional: boolean;
}

/**
 * Mercado que a VITRINE localizada apresenta (A2 da auditoria de 15/10/2026).
 *
 * Antes, `/en/produtos/...` significava USD e `/es|fr|de/...` EUR: um
 * britânico lendo em inglês via dólar americano até chegar ao checkout.
 * Agora o país vem da jornada (escolha no checkout → geolocalização, só
 * entre os destinos que CHECKOUT_PAISES atende) e a moeda é a do país.
 * Sem destino atendido, o mercado padrão do idioma continua valendo.
 */
export async function mercadoDaVitrine(locale: SiteLocale): Promise<MercadoDaVitrine> {
  const iso =
    locale === "pt"
      ? "BR"
      : destinoDaVitrine({
          locale,
          escolhido: (await cookies()).get(PAIS_ESCOLHIDO_COOKIE)?.value,
          detectado:
            (await headers()).get(GEO_COUNTRY_HEADER) ??
            (await headers()).get("x-vercel-ip-country") ??
            (await cookies()).get(GEO_COUNTRY_COOKIE)?.value,
          atendidos: paisesDoCheckout(),
        });
  const regra = regraDoPais(iso) ?? regraDoPais("BR")!;
  return { regra, nacional: regra.moedaPadrao === "BRL" };
}
