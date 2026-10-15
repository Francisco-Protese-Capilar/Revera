/**
 * País de entrega e idioma da interface são DUAS informações (15/10/2026).
 *
 * A auditoria do checkout reproduziu em produção: abrir
 * `/checkout?pais=GB`, clicar em EN no cabeçalho e o destino virar Estados
 * Unidos — porque a rota `/en/checkout` tratava o idioma como se fosse o
 * mercado. Idioma não autoriza mercado, não muda moeda e não troca frete.
 *
 * Este módulo é puro (sem `server-only`): roda no middleware, nas páginas e
 * nos testes com as mesmas funções, para que o `<html lang>` que o layout
 * escreve e o formulário que a página renderiza nunca discordem.
 *
 * Precedência do DESTINO (quem decide moeda, endereço, frete e imposto):
 *   1. escolha explícita válida na URL (`?pais=XX`);
 *   2. escolha já mantida na jornada (cookie gravado pelo middleware quando
 *      a pessoa clicou numa aba de país ou abriu um link com `?pais=`);
 *   3. país detectado na borda, quando o sistema o conhece — um país
 *      conhecido mas fechado recebe a tela de indisponibilidade, nunca vira
 *      Brasil/EUA em silêncio;
 *   4. mercado padrão do idioma da rota (`/de/checkout` sem nada acima cai
 *      na Alemanha, como antes) ou Brasil na rota sem prefixo.
 *
 * Precedência da TRADUÇÃO (só texto e o idioma pedido ao gateway):
 *   1. prefixo explícito na URL (`/fr/...`);
 *   2. preferência manual persistida (cookie gravado por clique no seletor);
 *   3. idioma padrão do destino resolvido acima.
 */
import { regraDoPais, idiomaDoPais } from "./paises";
import {
  DEFAULT_SITE_LOCALE,
  isSiteLocale,
  localeFromCountry,
  type SiteLocale,
} from "@/lib/i18n/site";

/**
 * Cookie do país ESCOLHIDO (não o detectado — esse é `revera_country`).
 * Vida curta de propósito: o que ele precisa sobreviver é uma jornada de
 * compra, inclusive a cotação DHL (6 h) e a volta do gateway. Um clique
 * curioso numa aba de país não pode mandar um brasileiro para o checkout
 * dos EUA semanas depois.
 */
export const PAIS_ESCOLHIDO_COOKIE = "revera_pais_entrega";
export const PAIS_ESCOLHIDO_MAX_AGE_S = 60 * 60 * 24;

export type OrigemDoDestino = "explicito" | "escolhido" | "detectado" | "idioma" | "padrao" | "invalido";

export interface DestinoResolvido {
  iso: string;
  origem: OrigemDoDestino;
}

/** ISO alfa-2 que a tabela de países conhece, ou null. */
export function paisConhecido(valor: string | null | undefined): string | null {
  if (!valor) return null;
  const iso = valor.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(iso)) return null;
  return regraDoPais(iso) ? iso : null;
}

/**
 * Mercado em que a rota localizada cai quando NADA mais diz o destino. É o
 * comportamento anterior (`/en/checkout` → EUA), mantido só como último
 * recurso: um alemão na Suíça abrindo `/de/checkout` por um anúncio ainda
 * vê a Alemanha, não o CEP brasileiro.
 */
export function mercadoPadraoDoIdioma(locale: SiteLocale | null | undefined): string {
  switch (locale) {
    case "en":
      return "US";
    case "es":
      return "ES";
    case "fr":
      return "FR";
    case "de":
      return "DE";
    default:
      return "BR";
  }
}

/**
 * Código que aparece na tela de indisponibilidade quando `?pais=` veio com
 * valor que a tabela não conhece: só letras e dígitos, curto, nunca o texto
 * cru da URL.
 */
function codigoParaExibir(valor: string): string {
  const limpo = valor.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return limpo || "??";
}

export function resolverPaisDeEntrega(entrada: {
  explicito?: string | null;
  escolhido?: string | null;
  detectado?: string | null;
  localeDaRota?: SiteLocale | null;
}): DestinoResolvido {
  const explicito = paisConhecido(entrada.explicito);
  if (explicito) return { iso: explicito, origem: "explicito" };
  // Parâmetro PRESENTE mas inválido não é o mesmo que ausente (Codex,
  // 15/10/2026): `/checkout?pais=ZZ` não pode cair em silêncio no país da
  // geolocalização nem no mercado do idioma. A tela diz "indisponível" e
  // oferece as abas para escolher; nada é gravado em cookie.
  if (typeof entrada.explicito === "string" && entrada.explicito.trim() !== "") {
    return { iso: codigoParaExibir(entrada.explicito), origem: "invalido" };
  }
  const escolhido = paisConhecido(entrada.escolhido);
  if (escolhido) return { iso: escolhido, origem: "escolhido" };
  const detectado = paisConhecido(entrada.detectado);
  if (detectado) return { iso: detectado, origem: "detectado" };
  if (entrada.localeDaRota && entrada.localeDaRota !== DEFAULT_SITE_LOCALE) {
    return { iso: mercadoPadraoDoIdioma(entrada.localeDaRota), origem: "idioma" };
  }
  return { iso: "BR", origem: "padrao" };
}

/**
 * Idioma que o destino sugere quando ninguém escolheu idioma.
 *
 * Destino escolhido (URL ou cookie) usa a tabela completa: quem abriu
 * `/checkout?pais=MX` lê a indisponibilidade em espanhol. Destino só
 * detectado usa o mapa restrito aos mercados oferecidos (`localeFromCountry`):
 * geolocalização em país que a loja não atende não troca a língua do site.
 */
export function idiomaPadraoDoDestino(destino: DestinoResolvido, localeDaRota?: SiteLocale | null): SiteLocale {
  switch (destino.origem) {
    case "explicito":
    case "escolhido":
      return idiomaDoPais(destino.iso);
    case "detectado":
      return localeFromCountry(destino.iso);
    case "idioma":
    case "invalido":
      return localeDaRota && isSiteLocale(localeDaRota) ? localeDaRota : DEFAULT_SITE_LOCALE;
    default:
      return DEFAULT_SITE_LOCALE;
  }
}

/**
 * Idioma final da jornada. Rota explícita vence; depois a escolha manual
 * gravada pelo seletor; por fim o padrão do destino.
 */
export function resolverIdiomaDaJornada(entrada: {
  localeDaRota?: SiteLocale | null;
  escolhaManual: boolean;
  localeManual?: SiteLocale | null;
  destino: DestinoResolvido;
}): SiteLocale {
  if (entrada.localeDaRota && isSiteLocale(entrada.localeDaRota)) return entrada.localeDaRota;
  if (entrada.escolhaManual && entrada.localeManual && isSiteLocale(entrada.localeManual)) {
    return entrada.localeManual;
  }
  return idiomaPadraoDoDestino(entrada.destino, entrada.localeDaRota);
}

/**
 * Destino que a VITRINE localizada usa para moeda e preços.
 *
 * Só honra escolha/geolocalização de país que o checkout atende hoje
 * (`atendidos` = CHECKOUT_PAISES): vitrine em moeda de mercado fechado seria
 * promessa de preço que o checkout vai negar. Sem destino atendido, cai no
 * mercado padrão do idioma, como antes.
 */
export function destinoDaVitrine(entrada: {
  locale: SiteLocale;
  escolhido?: string | null;
  detectado?: string | null;
  atendidos: readonly string[];
}): string {
  const atendidos = new Set(entrada.atendidos.map((p) => p.toUpperCase()));
  const escolhido = paisConhecido(entrada.escolhido);
  if (escolhido && atendidos.has(escolhido)) return escolhido;
  const detectado = paisConhecido(entrada.detectado);
  if (detectado && atendidos.has(detectado)) return detectado;
  return mercadoPadraoDoIdioma(entrada.locale);
}

/** URL da aba de país do checkout, preservando o prefixo de idioma da rota. */
export function hrefDoCheckoutDoPais(iso: string, localeDaRota?: SiteLocale | null): string {
  const prefixo = localeDaRota && localeDaRota !== DEFAULT_SITE_LOCALE ? `/${localeDaRota}` : "";
  return `${prefixo}/checkout?pais=${iso.toUpperCase()}`;
}
