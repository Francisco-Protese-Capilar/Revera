import "server-only";
import { cookies, headers } from "next/headers";
import { GEO_COUNTRY_COOKIE, GEO_COUNTRY_HEADER, type SiteLocale } from "@/lib/i18n/site";
import { paisesDoCheckout, regraDoPais, type RegraDePais } from "./paises";
import { PAIS_ESCOLHIDO_COOKIE, destinoDaVitrine } from "./destino";

export interface MercadoDaVitrine {
  /** ISO resolvido — ou o código inválido vindo de `?pais=`, só para exibir. */
  iso: string;
  /** Regra do país de entrega resolvido (moeda, locale de número/data). */
  regra: RegraDePais;
  /** Brasil: preço nacional em BRL, sem PTAX nem variant_prices. */
  nacional: boolean;
  /**
   * O checkout atende este destino hoje? Fechado, a vitrine mostra o produto
   * sem preço e convida a escolher outro país — nunca a moeda de um mercado
   * que o checkout vai negar.
   */
  aberto: boolean;
}

/**
 * Mercado que a VITRINE localizada apresenta (A2 da auditoria de 15/10/2026).
 *
 * Antes, `/en/produtos/...` significava USD e `/es|fr|de/...` EUR: um
 * britânico lendo em inglês via dólar americano até chegar ao checkout.
 * Agora o país vem da jornada (escolha no checkout → geolocalização
 * conhecida → mercado padrão do idioma), com a MESMA precedência do checkout,
 * e a moeda é a do país. Destino que CHECKOUT_PAISES não atende fica
 * `aberto: false`: a vitrine não precifica em moeda de outro mercado, mostra
 * o aviso e convida a escolher o país (Codex, 15/10/2026).
 */
export async function mercadoDaVitrine(locale: SiteLocale, paisExplicito?: string | null): Promise<MercadoDaVitrine> {
  // Português sem prefixo também segue o destino (Codex, 15/10/2026): quem
  // escolheu entrega no Reino Unido e voltou ao português vê libra na
  // vitrine, como verá no checkout. Brasil só quando a resolução dá Brasil.
  const destino = destinoDaVitrine({
    locale,
    explicito: paisExplicito,
    escolhido: (await cookies()).get(PAIS_ESCOLHIDO_COOKIE)?.value,
    detectado:
      (await headers()).get(GEO_COUNTRY_HEADER) ??
      (await headers()).get("x-vercel-ip-country") ??
      (await cookies()).get(GEO_COUNTRY_COOKIE)?.value,
    atendidos: paisesDoCheckout(),
  });
  const regra = regraDoPais(destino.iso);
  return {
    iso: destino.iso,
    regra: regra ?? regraDoPais("BR")!,
    nacional: Boolean(regra) && regra!.moedaPadrao === "BRL",
    aberto: destino.aberto,
  };
}
