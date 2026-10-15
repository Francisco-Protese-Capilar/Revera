/**
 * País de entrega × idioma da interface (auditoria do checkout, 15/10/2026).
 *
 * A1: trocar idioma não troca país nem moeda.
 * A2: os nove destinos do seletor têm idioma automático e moeda própria na
 *     vitrine.
 * A3: PayPal recebe fr-FR / de-DE (e as variantes regionais válidas).
 * A4: telas de falha de pagamento e erros do servidor nas cinco línguas.
 *
 * Nenhum teste aqui cria pedido, cobra ou fala com gateway real: os
 * provedores são exercitados com `fetch` simulado e o payload afirmado.
 */
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// O JSX dos Server Components compila para React.createElement no vitest.
vi.stubGlobal("React", React);
import { middleware } from "@/middleware";
import {
  GEO_COUNTRY_HEADER,
  LOCALE_BY_MARKET_COUNTRY,
  LOCALE_COOKIE,
  LOCALE_HEADER,
  LOCALE_MANUAL_COOKIE,
  SITE_LOCALES,
  localeFromCountry,
  localeManualDosCookies,
  localeSwitchPath,
  queryPreservadaNaTrocaDeIdioma,
  type SiteLocale,
} from "@/lib/i18n/site";
import {
  PAIS_ESCOLHIDO_COOKIE,
  destinoDaVitrine,
  hrefDoCheckoutDoPais,
  idiomaPadraoDoDestino,
  mercadoPadraoDoIdioma,
  resolverIdiomaDaJornada,
  resolverPaisDeEntrega,
} from "@/lib/internacional/destino";
import { PAISES, idiomaDoPais } from "@/lib/internacional/paises";
import { TEXTOS } from "@/lib/internacional/idioma";
import {
  MOTIVOS_PAGAMENTO_INDISPONIVEL,
  TEXTOS_PAGAMENTO_INDISPONIVEL,
  SUPORTE_POR_MOTIVO,
} from "@/app/checkout/pagamento/textos-indisponivel";

const ORIGEM = "https://www.reveraprotesecapilar.com";

/** Os nove destinos da matriz da auditoria, com idioma padrão e moeda. */
const MATRIZ = [
  { pais: "BR", idioma: "pt", moeda: "BRL", locale: "pt-BR" },
  { pais: "US", idioma: "en", moeda: "USD", locale: "en-US" },
  { pais: "ES", idioma: "es", moeda: "EUR", locale: "es-ES" },
  { pais: "FR", idioma: "fr", moeda: "EUR", locale: "fr-FR" },
  { pais: "DE", idioma: "de", moeda: "EUR", locale: "de-DE" },
  { pais: "PT", idioma: "pt", moeda: "EUR", locale: "pt-PT" },
  { pais: "GB", idioma: "en", moeda: "GBP", locale: "en-GB" },
  { pais: "CA", idioma: "en", moeda: "CAD", locale: "en-CA" },
  { pais: "AU", idioma: "en", moeda: "AUD", locale: "en-AU" },
] as const;
const PAISES_DA_MATRIZ = MATRIZ.map((m) => m.pais).join(",");

describe("A2 — a tabela da auditoria bate com a configuração dos países", () => {
  it.each(MATRIZ)("$pais: idioma $idioma, moeda $moeda, formato $locale", ({ pais, idioma, moeda, locale }) => {
    expect(PAISES[pais]?.idioma).toBe(idioma);
    expect(PAISES[pais]?.moedaPadrao).toBe(moeda);
    expect(PAISES[pais]?.locale).toBe(locale);
    // Entrada automática: o país detectado escolhe a mesma língua da tabela.
    expect(localeFromCountry(pais)).toBe(idioma);
    expect(LOCALE_BY_MARKET_COUNTRY[pais]).toBe(idiomaDoPais(pais));
  });

  it("o mapa automático não abre língua para país que o checkout não oferece", () => {
    expect(Object.keys(LOCALE_BY_MARKET_COUNTRY).sort()).toEqual([...MATRIZ.map((m) => m.pais)].sort());
    expect(localeFromCountry("MX")).toBe("pt");
    expect(localeFromCountry("NL")).toBe("pt");
    expect(localeFromCountry(null)).toBe("pt");
  });
});

describe("resolução do país de entrega", () => {
  it("escolha explícita válida vence tudo, inclusive geolocalização divergente", () => {
    expect(resolverPaisDeEntrega({ explicito: "gb", escolhido: "US", detectado: "BR" })).toEqual({ iso: "GB", origem: "explicito" });
  });
  it("escolha mantida na jornada vence o país detectado", () => {
    expect(resolverPaisDeEntrega({ escolhido: "CA", detectado: "BR" })).toEqual({ iso: "CA", origem: "escolhido" });
  });
  it("país detectado conhecido é preservado, mesmo fechado (a tela diz indisponível)", () => {
    expect(resolverPaisDeEntrega({ detectado: "MX" })).toEqual({ iso: "MX", origem: "detectado" });
  });
  it("sem nada, a rota localizada cai no mercado padrão do idioma e a rota sem prefixo no Brasil", () => {
    expect(resolverPaisDeEntrega({ localeDaRota: "de" })).toEqual({ iso: "DE", origem: "idioma" });
    expect(resolverPaisDeEntrega({ localeDaRota: "en", detectado: "JP" })).toEqual({ iso: "US", origem: "idioma" });
    expect(resolverPaisDeEntrega({})).toEqual({ iso: "BR", origem: "padrao" });
  });
  it("?pais= presente mas desconhecido é inválido: não cai em cookie, geolocalização nem mercado do idioma", () => {
    expect(resolverPaisDeEntrega({ explicito: "XX", escolhido: "GB", detectado: "US", localeDaRota: "de" })).toEqual({ iso: "XX", origem: "invalido" });
    expect(resolverPaisDeEntrega({ explicito: "usa" })).toEqual({ iso: "USA", origem: "invalido" });
    expect(resolverPaisDeEntrega({ explicito: "<script>" })).toEqual({ iso: "SCRIPT", origem: "invalido" });
    expect(resolverPaisDeEntrega({ explicito: "   " })).toEqual({ iso: "BR", origem: "padrao" });
  });
  it("cookie ou geolocalização inválidos são ignorados, sem virar destino", () => {
    expect(resolverPaisDeEntrega({ escolhido: "../", detectado: "ZZ" })).toEqual({ iso: "BR", origem: "padrao" });
    expect(resolverPaisDeEntrega({ escolhido: "x", detectado: "GB" })).toEqual({ iso: "GB", origem: "detectado" });
  });
  it("mercado padrão por idioma é o comportamento antigo, só como último recurso", () => {
    expect(mercadoPadraoDoIdioma("en")).toBe("US");
    expect(mercadoPadraoDoIdioma("es")).toBe("ES");
    expect(mercadoPadraoDoIdioma("fr")).toBe("FR");
    expect(mercadoPadraoDoIdioma("de")).toBe("DE");
    expect(mercadoPadraoDoIdioma("pt")).toBe("BR");
  });
});

describe("resolução do idioma da jornada", () => {
  it("prefixo da rota vence a escolha manual, que vence o padrão do destino", () => {
    const destino = { iso: "GB", origem: "explicito" as const };
    expect(resolverIdiomaDaJornada({ localeDaRota: "fr", escolhaManual: true, localeManual: "de", destino })).toBe("fr");
    expect(resolverIdiomaDaJornada({ localeDaRota: null, escolhaManual: true, localeManual: "de", destino })).toBe("de");
    expect(resolverIdiomaDaJornada({ localeDaRota: null, escolhaManual: false, localeManual: "de", destino })).toBe("en");
  });
  it("destino escolhido usa a tabela completa; detectado usa só os mercados oferecidos", () => {
    expect(idiomaPadraoDoDestino({ iso: "MX", origem: "explicito" })).toBe("es");
    expect(idiomaPadraoDoDestino({ iso: "MX", origem: "detectado" })).toBe("pt");
    expect(idiomaPadraoDoDestino({ iso: "GB", origem: "detectado" })).toBe("en");
    expect(idiomaPadraoDoDestino({ iso: "DE", origem: "idioma" }, "de")).toBe("de");
  });
  it("lê a escolha manual só quando a marca manual existe", () => {
    const jar = (valores: Record<string, string>) => (nome: string) => valores[nome];
    expect(localeManualDosCookies(jar({ [LOCALE_COOKIE]: "en" }))).toBeNull();
    expect(localeManualDosCookies(jar({ [LOCALE_COOKIE]: "en", [LOCALE_MANUAL_COOKIE]: "1" }))).toBe("en");
    expect(localeManualDosCookies(jar({ [LOCALE_COOKIE]: "xx", [LOCALE_MANUAL_COOKIE]: "1" }))).toBeNull();
  });
});

describe("A1 — o seletor de idioma carrega o país, e só o país", () => {
  it("preserva ?pais= na troca de idioma, em qualquer direção", () => {
    expect(localeSwitchPath("/checkout", "en", "?pais=GB")).toBe("/en/checkout?pais=GB");
    expect(localeSwitchPath("/fr/checkout", "pt", "pais=gb")).toBe("/pt/checkout?pais=GB");
    expect(localeSwitchPath("/checkout", "de", null)).toBe("/de/checkout");
  });
  it("não arrasta token de pedido, retorno de gateway nem UTM", () => {
    expect(queryPreservadaNaTrocaDeIdioma("pedido=abc&retorno=pagamento&utm_source=x")).toBe("");
    expect(queryPreservadaNaTrocaDeIdioma("pais=GB&pedido=abc")).toBe("?pais=GB");
    expect(queryPreservadaNaTrocaDeIdioma("pais=G1")).toBe("");
  });
  it("as abas de país mantêm o prefixo de idioma da rota", () => {
    expect(hrefDoCheckoutDoPais("gb", "fr")).toBe("/fr/checkout?pais=GB");
    expect(hrefDoCheckoutDoPais("US", null)).toBe("/checkout?pais=US");
    expect(hrefDoCheckoutDoPais("US", "pt")).toBe("/checkout?pais=US");
  });
  it("45 combinações: trocar entre os cinco idiomas preserva o país na URL", () => {
    for (const { pais } of MATRIZ) {
      for (const de of SITE_LOCALES) {
        for (const para of SITE_LOCALES) {
          const atual = `${de === "pt" ? "" : `/${de}`}/checkout`;
          const destino = localeSwitchPath(atual, para, `?pais=${pais}`);
          expect(destino).toBe(`/${para}/checkout?pais=${pais}`);
        }
      }
    }
  });
});

describe("A1 — middleware: país explícito e cookie da jornada", () => {
  function req(url: string, init: { headers?: Record<string, string>; method?: string; cookies?: Record<string, string> } = {}) {
    const r = new NextRequest(`${ORIGEM}${url}`, { headers: init.headers, method: init.method });
    for (const [k, v] of Object.entries(init.cookies ?? {})) r.cookies.set(k, v);
    return r;
  }
  const cookieGravado = (res: Response, nome: string) =>
    res.headers.getSetCookie().find((c) => c.startsWith(`${nome}=`)) ?? null;

  it("/checkout?pais=GB com geolocalização BR não redireciona, traduz para inglês e grava o país escolhido", () => {
    const res = middleware(req("/checkout?pais=GB", { headers: { "x-vercel-ip-country": "BR", "sec-fetch-dest": "document" } }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe("en");
    expect(res.headers.get(`x-middleware-request-${GEO_COUNTRY_HEADER}`)).toBe("BR");
    expect(cookieGravado(res, PAIS_ESCOLHIDO_COOKIE)).toContain("revera_pais_entrega=GB");
  });

  it("escolha manual de idioma vence o idioma do destino, sem mexer no país", () => {
    const res = middleware(req("/checkout?pais=GB", {
      headers: { "x-vercel-ip-country": "GB", "sec-fetch-dest": "document" },
      cookies: { [LOCALE_COOKIE]: "pt", [LOCALE_MANUAL_COOKIE]: "1" },
    }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe("pt");
    expect(cookieGravado(res, PAIS_ESCOLHIDO_COOKIE)).toContain("=GB");
  });

  it("/en/checkout?pais=GB fica em inglês, com o país gravado e o país detectado repassado", () => {
    const res = middleware(req("/en/checkout?pais=GB", { headers: { "x-vercel-ip-country": "BR", "sec-fetch-dest": "document" } }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe("en");
    expect(res.headers.get(`x-middleware-request-${GEO_COUNTRY_HEADER}`)).toBe("BR");
    expect(cookieGravado(res, PAIS_ESCOLHIDO_COOKIE)).toContain("=GB");
  });

  it("voltar ao português por /pt/checkout?pais=GB limpa o prefixo e mantém o país", () => {
    const res = middleware(req("/pt/checkout?pais=GB", { headers: { "sec-fetch-dest": "document" } }));
    expect(res.headers.get("location")).toBe(`${ORIGEM}/checkout?pais=GB`);
    expect(cookieGravado(res, LOCALE_MANUAL_COOKIE)).toContain("=1");
  });

  it("pré-carga, navegação RSC e POST não gravam país escolhido", () => {
    const precarga = middleware(req("/en/checkout?pais=GB", { headers: { "next-router-prefetch": "1", "sec-fetch-dest": "empty" } }));
    expect(cookieGravado(precarga, PAIS_ESCOLHIDO_COOKIE)).toBeNull();
    const rsc = middleware(req("/checkout?pais=GB", { headers: { rsc: "1", "sec-fetch-dest": "empty" } }));
    expect(cookieGravado(rsc, PAIS_ESCOLHIDO_COOKIE)).toBeNull();
    const post = middleware(req("/checkout?pais=GB", { method: "POST", headers: { "next-action": "abc" } }));
    expect(post.headers.get("location")).toBeNull();
    expect(cookieGravado(post, PAIS_ESCOLHIDO_COOKIE)).toBeNull();
  });

  it("país inválido na URL não grava cookie nem redireciona para o mercado da geolocalização", () => {
    const res = middleware(req("/checkout?pais=ZZ", { headers: { "x-vercel-ip-country": "US", "sec-fetch-dest": "document" } }));
    expect(cookieGravado(res, PAIS_ESCOLHIDO_COOKIE)).toBeNull();
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe("pt");
  });

  it("escolha manual de idioma vale em /checkout/pagamento e /pedido, sem redirect e sem mexer no país", () => {
    for (const caminho of ["/checkout/pagamento?pedido=tok", "/pedido/tok?retorno=pagamento"]) {
      const res = middleware(req(caminho, {
        headers: { "x-vercel-ip-country": "US", "sec-fetch-dest": "document" },
        cookies: { [PAIS_ESCOLHIDO_COOKIE]: "GB", [LOCALE_COOKIE]: "fr", [LOCALE_MANUAL_COOKIE]: "1" },
      }));
      expect(res.headers.get("location"), caminho).toBeNull();
      expect(res.headers.get(`x-middleware-request-${LOCALE_HEADER}`), caminho).toBe("fr");
      expect(cookieGravado(res, PAIS_ESCOLHIDO_COOKIE)).toBeNull();
    }
  });

  it("país escolhido na jornada leva a sacola e o checkout sem query ao idioma do destino", () => {
    const res = middleware(req("/checkout", {
      headers: { "x-vercel-ip-country": "BR", "sec-fetch-dest": "document" },
      cookies: { [PAIS_ESCOLHIDO_COOKIE]: "GB" },
    }));
    expect(res.headers.get("location")).toBe(`${ORIGEM}/en/checkout`);
  });

  it("a página de pagamento e o pedido recebem o idioma do destino escolhido, para o <html lang> bater com o conteúdo", () => {
    const res = middleware(req("/checkout/pagamento?pedido=tok", {
      headers: { "x-vercel-ip-country": "BR", "sec-fetch-dest": "document" },
      cookies: { [PAIS_ESCOLHIDO_COOKIE]: "DE" },
    }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe("de");
  });

  it("?pais= numa página de produto vale como escolha: grava o cookie e segue o idioma do destino", () => {
    const semPrefixo = middleware(req("/produtos/micropele-008?pais=GB", { headers: { "x-vercel-ip-country": "BR", "sec-fetch-dest": "document" } }));
    expect(semPrefixo.headers.get("location")).toBe(`${ORIGEM}/en/produtos/micropele-008?pais=GB`);
    const localizado = middleware(req("/en/produtos/micropele-008?pais=GB", { headers: { "x-vercel-ip-country": "BR", "sec-fetch-dest": "document" } }));
    expect(localizado.headers.get("location")).toBeNull();
    expect(cookieGravado(localizado, PAIS_ESCOLHIDO_COOKIE)).toContain("=GB");
    const invalido = middleware(req("/en/produtos/micropele-008?pais=ZZ", { headers: { "sec-fetch-dest": "document" } }));
    expect(cookieGravado(invalido, PAIS_ESCOLHIDO_COOKIE)).toBeNull();
  });

  it("brasileiro sem escolha nenhuma continua em português, no checkout nacional", () => {
    const res = middleware(req("/checkout", { headers: { "x-vercel-ip-country": "BR", "sec-fetch-dest": "document" } }));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe("pt");
  });
});

describe("A2 — vitrine localizada precifica pelo destino, não pelo idioma", () => {
  const atendidos = PAISES_DA_MATRIZ.split(",");
  it("inglês com destino britânico, canadense ou australiano mantém a moeda do destino", () => {
    expect(destinoDaVitrine({ locale: "en", detectado: "GB", atendidos })).toEqual({ iso: "GB", aberto: true });
    expect(destinoDaVitrine({ locale: "en", detectado: "CA", atendidos })).toEqual({ iso: "CA", aberto: true });
    expect(destinoDaVitrine({ locale: "en", escolhido: "AU", detectado: "US", atendidos })).toEqual({ iso: "AU", aberto: true });
    expect(PAISES.GB!.moedaPadrao).toBe("GBP");
  });
  it("brasileiro lendo em inglês continua no Brasil, em real", () => {
    expect(destinoDaVitrine({ locale: "en", detectado: "BR", atendidos })).toEqual({ iso: "BR", aberto: true });
  });
  it("país desconhecido cai no mercado padrão do idioma", () => {
    expect(destinoDaVitrine({ locale: "en", detectado: "JP", atendidos })).toEqual({ iso: "US", aberto: true });
    expect(destinoDaVitrine({ locale: "de", escolhido: "../", detectado: "CH", atendidos })).toEqual({ iso: "DE", aberto: true });
  });
  it("país conhecido mas fechado é preservado como fechado — a vitrine não precifica em moeda de outro mercado", () => {
    expect(destinoDaVitrine({ locale: "es", detectado: "MX", atendidos })).toEqual({ iso: "MX", aberto: false });
    expect(destinoDaVitrine({ locale: "de", escolhido: "MX", detectado: "DE", atendidos })).toEqual({ iso: "MX", aberto: false });
    expect(destinoDaVitrine({ locale: "fr", detectado: "GB", atendidos: ["BR", "US"] })).toEqual({ iso: "GB", aberto: false });
    expect(destinoDaVitrine({ locale: "fr", atendidos: ["BR", "US"] })).toEqual({ iso: "FR", aberto: false });
  });
});

/* =========================================================================
 * A1 — a página do checkout, com as 45 combinações país × idioma
 * =======================================================================*/

const estado = vi.hoisted(() => ({
  cookies: {} as Record<string, string>,
  headers: {} as Record<string, string>,
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (nome: string) => (estado.cookies[nome] ? { value: estado.cookies[nome] } : undefined) }),
  headers: async () => ({ get: (nome: string) => estado.headers[nome] ?? null }),
}));
vi.mock("@/app/checkout/CheckoutForm", () => ({ CheckoutForm: () => null }));
vi.mock("@/components/cart/CartProvider", () => ({ useCart: () => ({ adicionarItem: vi.fn(), pendente: false }) }));
vi.mock("@/lib/conteudo/fotos-do-site", () => ({
  urlDaFotoDoSite: async (path: string) => path,
  urlsDasFotosDoSite: async (paths: string[]) => new Map(paths.map((p) => [p, p])),
}));
vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("notFound"); },
  redirect: (destino: string) => { throw new Error(`redirect:${destino}`); },
}));
vi.mock("@/app/checkout/CheckoutInternacionalForm", () => ({ CheckoutInternacionalForm: () => null }));
vi.mock("@/lib/cart/store", () => ({
  lerCarrinhoCompleto: vi.fn(async () => ({
    cartId: "cart-fixture",
    items: [{ variantId: "v1", quantity: 2, basePriceCents: 65000, productSlug: "micropele-008", productName: "Micropele 0,08mm", variantLabel: "1B" }],
  })),
}));
vi.mock("@/lib/internacional/mercado", async () => {
  const { PAISES } = await import("@/lib/internacional/paises");
  return {
    prontidaoDoMercado: vi.fn(async (pais: string) => ({ aberto: true, moeda: PAISES[pais]!.moedaPadrao })),
    precosDoCarrinhoNoMercado: vi.fn(async (itens: Array<{ variantId: string; quantity: number; basePriceCents: number }>) => ({
      ok: true,
      itens: itens.map((i) => ({ variantId: i.variantId, quantity: i.quantity, unitPriceCents: i.basePriceCents / 5, subtotalCents: (i.basePriceCents / 5) * i.quantity })),
      subtotalCents: itens.reduce((s, i) => s + (i.basePriceCents / 5) * i.quantity, 0),
    })),
  };
});
vi.mock("@/lib/internacional/cambio-ptax", async () => {
  const real = await vi.importActual<typeof import("@/lib/internacional/cambio-ptax")>("@/lib/internacional/cambio-ptax");
  return {
    // Conversão REAL (a mesma que o checkout usa); só a taxa é determinística.
    converterCentavosBrl: real.converterCentavosBrl,
    obterCotacaoPtax: vi.fn(async (moeda: string) => ({ moeda, reaisPorUnidade: 5, data: "2026-10-15", fonte: "fixture" })),
  };
});
vi.mock("@/lib/payments/revera", () => ({
  provedoresInternacionaisDisponiveis: vi.fn(async () => ["stripe", "paypal"]),
  reveraApplePayDisponivel: vi.fn(async () => false),
}));

type Elemento = { type: unknown; props: Record<string, unknown> & { children?: unknown } };

function* percorrer(no: unknown): Generator<Elemento> {
  if (!no || typeof no !== "object") return;
  if (Array.isArray(no)) {
    for (const filho of no) yield* percorrer(filho);
    return;
  }
  const el = no as Elemento;
  if (!("props" in el)) return;
  yield el;
  yield* percorrer(el.props.children);
}

function encontrar(arvore: unknown, predicado: (el: Elemento) => boolean): Elemento | null {
  for (const el of percorrer(arvore)) if (predicado(el)) return el;
  return null;
}

describe("A1 — página do checkout: 9 países × 5 idiomas preservam destino e moeda", () => {
  beforeEach(() => {
    vi.stubEnv("CHECKOUT_PAISES", PAISES_DA_MATRIZ);
    estado.cookies = {};
    estado.headers = {};
  });

  async function renderizar(pais: string, idioma: SiteLocale, extra: { localeDaRota?: SiteLocale | null } = {}) {
    const { renderCheckout } = await import("@/app/checkout/renderizar-checkout");
    const { CheckoutForm } = await import("@/app/checkout/CheckoutForm");
    const { CheckoutInternacionalForm } = await import("@/app/checkout/CheckoutInternacionalForm");
    const localeDaRota = extra.localeDaRota === undefined ? (idioma === "pt" ? null : idioma) : extra.localeDaRota;
    const arvore = await renderCheckout({ localeDaRota, paisExplicito: pais });
    const main = encontrar(arvore, (el) => el.type === "main")!;
    const nav = encontrar(arvore, (el) => el.type === "nav");
    const abaAtiva = nav
      ? [...percorrer(nav)].find((el) => typeof el.props.className === "string" && (el.props.className as string).includes("bg-ink text-paper"))
      : null;
    const nacional = encontrar(arvore, (el) => el.type === CheckoutForm);
    const internacional = encontrar(arvore, (el) => el.type === CheckoutInternacionalForm);
    return { main, abaAtiva, nacional, internacional };
  }

  for (const { pais, moeda, locale } of MATRIZ) {
    for (const idioma of SITE_LOCALES) {
      it(`${pais} + ${idioma}: destino ${pais}, moeda ${moeda}, tela em ${idioma}`, async () => {
        // Português não tem rota prefixada: a combinação PT-idioma vem da
        // escolha manual gravada pelo seletor.
        if (idioma === "pt") estado.cookies = { [LOCALE_COOKIE]: "pt", [LOCALE_MANUAL_COOKIE]: "1" };
        // Geolocalização divergente de propósito: ela nunca vence a escolha.
        estado.headers = { [GEO_COUNTRY_HEADER]: pais === "US" ? "BR" : "US" };
        const { main, abaAtiva, nacional, internacional } = await renderizar(pais, idioma);
        expect(main.props.lang).toBe(TEXTOS[idioma] ? (idioma === "pt" ? "pt-BR" : idioma) : "pt-BR");
        expect(String(abaAtiva?.props.href)).toContain(`pais=${pais}`);
        if (pais === "BR") {
          expect(nacional).not.toBeNull();
          expect(internacional).toBeNull();
        } else {
          const resumo = internacional!.props.resumo as { idioma: string; locale: string; moeda: string; pais: { iso: string } };
          expect(nacional).toBeNull();
          expect(resumo.pais.iso).toBe(pais);
          expect(resumo.moeda).toBe(moeda);
          expect(resumo.locale).toBe(locale);
          expect(resumo.idioma).toBe(idioma);
        }
      });
    }
  }

  it("/en/checkout sem país e sem escolha segue a geolocalização conhecida (GB → GBP), não os EUA", async () => {
    estado.headers = { [GEO_COUNTRY_HEADER]: "GB" };
    const { internacional } = await renderizar("", "en");
    expect((internacional!.props.resumo as { pais: { iso: string }; moeda: string }).pais.iso).toBe("GB");
    expect((internacional!.props.resumo as { moeda: string }).moeda).toBe("GBP");
  });

  it("/en/checkout com geolocalização BR entrega no Brasil, em real, com a casca em inglês", async () => {
    estado.headers = { [GEO_COUNTRY_HEADER]: "BR" };
    const { main, nacional, abaAtiva } = await renderizar("", "en");
    expect(nacional).not.toBeNull();
    expect(main.props.lang).toBe("en");
    expect(String(abaAtiva?.props.href)).toBe("/en/checkout?pais=BR");
  });

  it("/de/checkout sem destino nenhum ainda cai na Alemanha (último recurso), não no CEP", async () => {
    const { internacional } = await renderizar("", "de");
    expect((internacional!.props.resumo as { pais: { iso: string }; moeda: string }).pais.iso).toBe("DE");
    expect((internacional!.props.resumo as { moeda: string }).moeda).toBe("EUR");
  });

  it("cookie da jornada vence a geolocalização; a escolha explícita vence o cookie", async () => {
    estado.cookies = { [PAIS_ESCOLHIDO_COOKIE]: "CA" };
    estado.headers = { [GEO_COUNTRY_HEADER]: "US" };
    const porCookie = await renderizar("", "en");
    expect((porCookie.internacional!.props.resumo as { pais: { iso: string } }).pais.iso).toBe("CA");
    const porUrl = await renderizar("AU", "en");
    expect((porUrl.internacional!.props.resumo as { pais: { iso: string }; moeda: string }).moeda).toBe("AUD");
  });

  it("?pais= desconhecido mostra indisponibilidade com as abas, sem cair na geolocalização nem no mercado do idioma", async () => {
    estado.cookies = { [PAIS_ESCOLHIDO_COOKIE]: "GB" };
    estado.headers = { [GEO_COUNTRY_HEADER]: "US" };
    const { renderCheckout } = await import("@/app/checkout/renderizar-checkout");
    const { CheckoutForm } = await import("@/app/checkout/CheckoutForm");
    const { CheckoutInternacionalForm } = await import("@/app/checkout/CheckoutInternacionalForm");
    const arvore = await renderCheckout({ localeDaRota: "en", paisExplicito: "zz" });
    expect(encontrar(arvore, (el) => el.type === CheckoutForm)).toBeNull();
    expect(encontrar(arvore, (el) => el.type === CheckoutInternacionalForm)).toBeNull();
    const indisponivel = encontrar(arvore, (el) => typeof el.type === "function" && (el.type as { name: string }).name === "IndisponivelInternacional");
    expect(indisponivel!.props.pais).toBe("ZZ");
    expect(indisponivel!.props.idioma).toBe("en");
    expect(indisponivel!.props.motivo).toMatch(/not available/);
    const nav = encontrar(arvore, (el) => el.type === "nav")!;
    expect([...percorrer(nav)].some((el) => String(el.props.href ?? "").endsWith("pais=GB"))).toBe(true);
  });

  it("país conhecido mas fechado mostra indisponibilidade no idioma da tela, não vira Brasil nem EUA", async () => {
    vi.stubEnv("CHECKOUT_PAISES", "BR,US");
    const { renderCheckout } = await import("@/app/checkout/renderizar-checkout");
    const { prontidaoDoMercado } = await import("@/lib/internacional/mercado");
    (prontidaoDoMercado as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ aberto: false, motivo: "fechado", codigo: "pais" });
    const arvore = await renderCheckout({ localeDaRota: "fr", paisExplicito: "GB" });
    const indisponivel = encontrar(arvore, (el) => typeof el.type === "function" && (el.type as { name: string }).name === "IndisponivelInternacional");
    expect(indisponivel).not.toBeNull();
    expect(indisponivel!.props.pais).toBe("GB");
    expect(indisponivel!.props.idioma).toBe("fr");
    expect(indisponivel!.props.motivo).toMatch(/destination/);
  });
});

/* =========================================================================
 * A2 — vitrine integrada: mercadoDaVitrine e a página de produto
 * =======================================================================*/

const vitrine = vi.hoisted(() => ({
  produto: null as null | Record<string, unknown>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: (tabela: string) => {
      const consulta: Record<string, unknown> = {};
      const encadear = () => consulta;
      Object.assign(consulta, {
        select: encadear, eq: encadear, in: encadear, gt: encadear, order: encadear,
        maybeSingle: async () => ({ data: tabela === "products" ? vitrine.produto : null }),
        then: (resolve: (v: unknown) => void) =>
          resolve({ data: tabela === "variant_prices" ? [{ variant_id: "v-gbp" }] : tabela === "colors" ? [] : [] }),
      });
      return consulta;
    },
  }),
  createAdminClient: () => { throw new Error("não usado aqui"); },
}));

describe("A2 — mercadoDaVitrine e página de produto localizada", () => {
  beforeEach(() => {
    vi.stubEnv("CHECKOUT_PAISES", PAISES_DA_MATRIZ);
    estado.cookies = {};
    estado.headers = {};
    vitrine.produto = {
      id: "p1", slug: "micropele-008", name: "Micropele 0,08mm", description: "desc",
      product_variants: [
        { id: "v-gbp", color_id: null, price_cents: 65000, stock_qty: 3, is_active: true },
        { id: "v-sem-preco-intl", color_id: null, price_cents: 65000, stock_qty: 3, is_active: true },
      ],
      product_media: [],
    };
  });

  it("cookie de país escolhido vence a geolocalização; inválido é ignorado", async () => {
    const { mercadoDaVitrine } = await import("@/lib/internacional/destino-server");
    estado.cookies = { [PAIS_ESCOLHIDO_COOKIE]: "GB" };
    estado.headers = { [GEO_COUNTRY_HEADER]: "US" };
    expect(await mercadoDaVitrine("en")).toMatchObject({ nacional: false, aberto: true, regra: { iso: "GB", moedaPadrao: "GBP" } });
    estado.cookies = { [PAIS_ESCOLHIDO_COOKIE]: "../etc" };
    expect(await mercadoDaVitrine("en")).toMatchObject({ aberto: true, regra: { iso: "US", moedaPadrao: "USD" } });
  });

  it("país conhecido fora de CHECKOUT_PAISES fica como destino FECHADO, igual ao checkout — nunca vira o mercado do idioma", async () => {
    vi.stubEnv("CHECKOUT_PAISES", "BR,US,DE");
    const { mercadoDaVitrine } = await import("@/lib/internacional/destino-server");
    estado.cookies = { [PAIS_ESCOLHIDO_COOKIE]: "GB" };
    estado.headers = { [GEO_COUNTRY_HEADER]: "CA" };
    expect(await mercadoDaVitrine("en")).toMatchObject({ aberto: false, regra: { iso: "GB" } });
    estado.cookies = {};
    expect(await mercadoDaVitrine("en")).toMatchObject({ aberto: false, regra: { iso: "CA" } });
    // Até o mercado padrão do idioma pode estar fechado: FR fora da lista.
    estado.headers = {};
    expect(await mercadoDaVitrine("fr")).toMatchObject({ aberto: false, regra: { iso: "FR" } });
    // Mesmo destino no checkout: GB conhecido, fechado → indisponibilidade.
    expect(resolverPaisDeEntrega({ escolhido: "GB", detectado: "CA" })).toEqual({ iso: "GB", origem: "escolhido" });
  });

  it("destino fechado: produto sem preço, sem 'adicionar', com convite para escolher o país", async () => {
    vi.stubEnv("CHECKOUT_PAISES", "BR,US,DE");
    estado.headers = { [GEO_COUNTRY_HEADER]: "GB" };
    const { default: ProdutoLocalizado } = await import("@/app/[locale]/produtos/[slug]/page");
    const { ProdutoInternacional } = await import("@/app/[locale]/produtos/[slug]/ProdutoInternacional");
    const { obterCotacaoPtax } = await import("@/lib/internacional/cambio-ptax");
    (obterCotacaoPtax as unknown as ReturnType<typeof vi.fn>).mockClear();
    const arvore = await ProdutoLocalizado({ params: Promise.resolve({ locale: "en", slug: "micropele-008" }), searchParams: Promise.resolve({}) });
    const el = encontrar(arvore, (x) => x.type === ProdutoInternacional)!;
    expect(el.props.mercadoFechadoPara).toBe("United Kingdom");
    expect((el.props.variants as Array<{ priceCents: number }>).every((v) => v.priceCents === 0)).toBe(true);
    expect(obterCotacaoPtax).not.toHaveBeenCalled();
    // E o componente de fato esconde preço e botão, mostrando o aviso.
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(
      React.createElement(ProdutoInternacional, {
        name: "Micropele", description: null, imageUrl: null, locale: "en", currency: "GBP", moneyLocale: "en-GB",
        variants: [{ id: "v", colorId: null, colorCode: "1B", colorName: null, colorPhotoUrl: null, stockQty: 2, priceBrlCents: 65000, priceCents: 0 }],
        mercadoFechadoPara: "United Kingdom",
      })
    );
    expect(html).toContain("Sales to United Kingdom are not available yet");
    expect(html).not.toContain("preco-internacional");
    expect(html).not.toContain("Add to cart");
    expect(html).toContain('href="/en/checkout"');
  });

  it("destino fechado: catálogo lista as peças sem preço e com o aviso", async () => {
    vi.stubEnv("CHECKOUT_PAISES", "BR,US,DE");
    estado.headers = { [GEO_COUNTRY_HEADER]: "GB" };
    const { ProdutosContent } = await import("@/app/produtos/ProdutosContent");
    const arvore = await ProdutosContent({ locale: "en" });
    const aviso = encontrar(arvore, (el) => el.props["data-testid"] === "mercado-fechado");
    expect(aviso).not.toBeNull();
    expect(JSON.stringify(aviso!.props.children)).toContain("Sales to United Kingdom are not available yet");
  });

  it("português sem prefixo segue o destino escolhido, como o checkout: GB em libra, Brasil só quando é Brasil", async () => {
    const { mercadoDaVitrine } = await import("@/lib/internacional/destino-server");
    estado.cookies = { [PAIS_ESCOLHIDO_COOKIE]: "GB" };
    expect(await mercadoDaVitrine("pt")).toMatchObject({ nacional: false, aberto: true, regra: { iso: "GB", moedaPadrao: "GBP" } });
    estado.cookies = {};
    estado.headers = { [GEO_COUNTRY_HEADER]: "PT" };
    expect(await mercadoDaVitrine("pt")).toMatchObject({ nacional: false, aberto: true, regra: { iso: "PT", moedaPadrao: "EUR" } });
    estado.headers = { [GEO_COUNTRY_HEADER]: "BR" };
    expect(await mercadoDaVitrine("pt")).toMatchObject({ nacional: true, regra: { moedaPadrao: "BRL" } });
    estado.headers = {};
    expect(await mercadoDaVitrine("pt")).toMatchObject({ nacional: true, regra: { moedaPadrao: "BRL" } });
  });

  it("sem cookie e sem query, vitrine e checkout resolvem o MESMO destino pelo país detectado, por qualquer das três fontes", async () => {
    const { mercadoDaVitrine } = await import("@/lib/internacional/destino-server");
    const { renderCheckout } = await import("@/app/checkout/renderizar-checkout");
    const { CheckoutInternacionalForm } = await import("@/app/checkout/CheckoutInternacionalForm");
    const { CheckoutForm } = await import("@/app/checkout/CheckoutForm");
    const fontes = [
      (iso: string) => ({ headers: { [GEO_COUNTRY_HEADER]: iso }, cookies: {} }),
      (iso: string) => ({ headers: { "x-vercel-ip-country": iso }, cookies: {} }),
      (iso: string) => ({ headers: {}, cookies: { ["revera_country"]: iso } }),
    ];
    for (const { pais, moeda } of MATRIZ) {
      for (const fonte of fontes) {
        const { headers, cookies } = fonte(pais);
        estado.headers = headers;
        estado.cookies = cookies;
        const locale: SiteLocale = pais === "BR" ? "pt" : "en";
        const vitrine = await mercadoDaVitrine(locale);
        expect(vitrine.regra.iso, `${pais} vitrine`).toBe(pais);
        expect(vitrine.regra.moedaPadrao, `${pais} vitrine`).toBe(moeda);
        expect(vitrine.aberto).toBe(true);
        const arvore = await renderCheckout({ localeDaRota: locale === "pt" ? null : locale, paisExplicito: undefined });
        if (pais === "BR") {
          expect(encontrar(arvore, (el) => el.type === CheckoutForm), `${pais} checkout`).not.toBeNull();
        } else {
          const resumo = encontrar(arvore, (el) => el.type === CheckoutInternacionalForm)!.props.resumo as { pais: { iso: string }; moeda: string };
          expect(resumo.pais.iso, `${pais} checkout`).toBe(pais);
          expect(resumo.moeda, `${pais} checkout`).toBe(moeda);
        }
      }
    }
  });

  it("?pais= na URL da vitrine vence cookie e geolocalização; inválido fica fechado", async () => {
    const { mercadoDaVitrine } = await import("@/lib/internacional/destino-server");
    estado.cookies = { [PAIS_ESCOLHIDO_COOKIE]: "US" };
    estado.headers = { [GEO_COUNTRY_HEADER]: "US" };
    expect(await mercadoDaVitrine("en", "gb")).toMatchObject({ aberto: true, nacional: false, regra: { iso: "GB", moedaPadrao: "GBP" } });
    expect(await mercadoDaVitrine("en", "ZZ")).toMatchObject({ aberto: false, nacional: false, iso: "ZZ" });
    expect(await mercadoDaVitrine("pt", "br")).toMatchObject({ aberto: true, nacional: true, regra: { iso: "BR" } });
  });

  // A rota nacional importa a página inteira (ProdutoInterativo, textos,
  // fotos); o primeiro import frio passa de 5 s em máquina lenta.
  it("página de produto em português com destino GB usa a precificação internacional, em português", { timeout: 30_000 }, async () => {
    estado.cookies = { [PAIS_ESCOLHIDO_COOKIE]: "GB" };
    const { default: ProdutoNacional } = await import("@/app/produtos/[slug]/page");
    const { ProdutoInternacional } = await import("@/app/[locale]/produtos/[slug]/ProdutoInternacional");
    const { converterCentavosBrl } = await import("@/lib/internacional/cambio-ptax");
    const arvore = await ProdutoNacional({ params: Promise.resolve({ slug: "micropele-008" }), searchParams: Promise.resolve({}) });
    const el = encontrar(arvore, (x) => x.type === ProdutoInternacional)!;
    expect(el.props.locale).toBe("pt");
    expect(el.props.currency).toBe("GBP");
    expect((el.props.variants as Array<{ priceCents: number }>)[0]!.priceCents).toBe(converterCentavosBrl(65000, 5));
  });

  it("sacola nacional com destino fora do Brasil vai para o checkout, como a sacola localizada", async () => {
    estado.cookies = { [PAIS_ESCOLHIDO_COOKIE]: "PT" };
    const { default: CarrinhoPage } = await import("@/app/carrinho/page");
    await expect(CarrinhoPage()).rejects.toThrow("redirect:/checkout");
    estado.cookies = {};
    await expect(CarrinhoPage()).resolves.toBeTruthy();
  });

  it("a sacola no navegador reconhece o destino pelos cookies, sem autoridade sobre preço", async () => {
    const { destinoDoNavegador } = await import("@/lib/internacional/destino");
    expect(destinoDoNavegador("revera_pais_entrega=GB; revera_country=BR")).toBe("GB");
    expect(destinoDoNavegador("revera_country=PT")).toBe("PT");
    expect(destinoDoNavegador("revera_pais_entrega=../; revera_country=ZZ")).toBeNull();
    expect(destinoDoNavegador("")).toBeNull();
  });

  it("produto em /en com destino GB mostra GBP com a MESMA conversão do checkout, só para variantes elegíveis", async () => {
    estado.headers = { [GEO_COUNTRY_HEADER]: "GB" };
    const { default: ProdutoLocalizado } = await import("@/app/[locale]/produtos/[slug]/page");
    const { ProdutoInternacional } = await import("@/app/[locale]/produtos/[slug]/ProdutoInternacional");
    const { converterCentavosBrl } = await import("@/lib/internacional/cambio-ptax");
    const arvore = await ProdutoLocalizado({ params: Promise.resolve({ locale: "en", slug: "micropele-008" }), searchParams: Promise.resolve({}) });
    const el = encontrar(arvore, (x) => x.type === ProdutoInternacional)!;
    expect(el.props.currency).toBe("GBP");
    expect(el.props.moneyLocale).toBe("en-GB");
    expect(el.props.mercadoNacional).toBe(false);
    const variantes = el.props.variants as Array<{ id: string; priceCents: number; priceBrlCents: number }>;
    expect(variantes.map((v) => v.id)).toEqual(["v-gbp"]);
    expect(variantes[0]!.priceCents).toBe(converterCentavosBrl(65000, 5));
    expect(variantes[0]!.priceBrlCents).toBe(65000);
  });

  it("produto em /en com destino BR mostra o preço nacional em real e frete nacional", async () => {
    estado.headers = { [GEO_COUNTRY_HEADER]: "BR" };
    const { default: ProdutoLocalizado } = await import("@/app/[locale]/produtos/[slug]/page");
    const { ProdutoInternacional } = await import("@/app/[locale]/produtos/[slug]/ProdutoInternacional");
    const arvore = await ProdutoLocalizado({ params: Promise.resolve({ locale: "en", slug: "micropele-008" }), searchParams: Promise.resolve({}) });
    const el = encontrar(arvore, (x) => x.type === ProdutoInternacional)!;
    expect(el.props.currency).toBe("BRL");
    expect(el.props.moneyLocale).toBe("pt-BR");
    expect(el.props.mercadoNacional).toBe(true);
    const variantes = el.props.variants as Array<{ id: string; priceCents: number }>;
    expect(variantes.map((v) => v.priceCents)).toEqual([65000, 65000]);
  });

  it("destino BR usa a regra de variante vendável da vitrine nacional: sem estoque ou sem preço não entra", async () => {
    estado.headers = { [GEO_COUNTRY_HEADER]: "BR" };
    vitrine.produto!.product_variants = [
      { id: "ok", color_id: null, price_cents: 65000, stock_qty: 1, is_active: true },
      { id: "sem-estoque", color_id: null, price_cents: 65000, stock_qty: 0, is_active: true },
      { id: "sem-preco", color_id: null, price_cents: 0, stock_qty: 5, is_active: true },
      { id: "inativa", color_id: null, price_cents: 65000, stock_qty: 5, is_active: false },
    ];
    const { default: ProdutoLocalizado } = await import("@/app/[locale]/produtos/[slug]/page");
    const { ProdutoInternacional } = await import("@/app/[locale]/produtos/[slug]/ProdutoInternacional");
    const arvore = await ProdutoLocalizado({ params: Promise.resolve({ locale: "en", slug: "micropele-008" }), searchParams: Promise.resolve({}) });
    const el = encontrar(arvore, (x) => x.type === ProdutoInternacional)!;
    expect((el.props.variants as Array<{ id: string }>).map((v) => v.id)).toEqual(["ok"]);
  });
});

/* =========================================================================
 * A3 — payload dos provedores
 * =======================================================================*/

describe("A3 — PayPal e Stripe recebem o idioma da tela", () => {
  const ORDER = "99999999-9999-4999-8999-999999999999";
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PAYPAL_ENV", "sandbox");
    vi.stubEnv("PAYPAL_CLIENT_ID", "client_teste");
    vi.stubEnv("PAYPAL_CLIENT_SECRET", "secret_teste");
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_x");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_teste");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  it("localePayPal cobre as cinco línguas e as variantes regionais válidas", async () => {
    const { localePayPal } = await import("@/lib/payments/paypal-provider");
    expect(localePayPal("pt")).toBe("pt-BR");
    expect(localePayPal("en")).toBe("en-US");
    expect(localePayPal("es")).toBe("es-ES");
    expect(localePayPal("fr")).toBe("fr-FR");
    expect(localePayPal("de")).toBe("de-DE");
    expect(localePayPal("en-GB")).toBe("en-GB");
    expect(localePayPal("en-AU")).toBe("en-AU");
    expect(localePayPal("en-CA")).toBe("en-US");
    expect(localePayPal("fr-CA")).toBe("fr-CA");
    expect(localePayPal("pt-PT")).toBe("pt-PT");
    expect(localePayPal("it")).toBe("en-US");
    expect(localePayPal(undefined)).toBe("en-US");
  });

  it.each([
    ["pt", "pt-BR"],
    ["en", "en-US"],
    ["es", "es-ES"],
    ["fr", "fr-FR"],
    ["de", "de-DE"],
  ])("createCharge do PayPal envia experience_context.locale %s → %s", async (idioma, esperado) => {
    let localeEnviado: string | null = null;
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "access", expires_in: 3600 }), { status: 200 });
      }
      const body = JSON.parse(String(init?.body ?? "{}"));
      localeEnviado = body.payment_source.paypal.experience_context.locale;
      expect(body.purchase_units[0].amount).toEqual({ currency_code: "EUR", value: "970.00" });
      return new Response(JSON.stringify({ id: "PAYPAL-ORDER-1", status: "CREATED", links: [{ rel: "approve", href: "https://www.sandbox.paypal.com/checkoutnow?token=PAYPAL-ORDER-1" }] }), { status: 201 });
    }));
    const { PayPalProvider } = await import("@/lib/payments/paypal-provider");
    await new PayPalProvider().createCharge({
      orderId: ORDER,
      orderNumber: "REV-X",
      amountCents: 97000,
      currency: "EUR",
      locale: idioma,
      redirectUrl: "https://revera.test/pedido/t",
      webhookUrl: "https://revera.test/api/webhooks/pagamento/s",
      expiresAt: new Date(Date.now() + 6 * 60 * 60_000 + 20_000),
      items: [{ description: "Micropele", quantity: 1, priceCents: 97000 }],
    });
    expect(localeEnviado).toBe(esperado);
  });

  it.each([
    ["pt", "pt"],
    ["en", "en"],
    ["es", "es"],
    ["fr", "fr"],
    ["de", "de"],
  ])("createCharge da Stripe envia locale %s → %s", async (idioma, esperado) => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "cs_test_ok", url: "https://checkout.stripe.com/x" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { StripeProvider } = await import("@/lib/payments/stripe-provider");
    await new StripeProvider().createCharge({
      orderId: ORDER,
      orderNumber: "REV-X",
      amountCents: 97000,
      currency: "EUR",
      locale: idioma,
      redirectUrl: "https://x/pedido/t",
      webhookUrl: "https://x/wh",
      items: [{ description: "Micropele", quantity: 1, priceCents: 97000 }],
    });
    const body = new URLSearchParams(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.get("locale")).toBe(esperado);
    expect(body.get("line_items[0][price_data][currency]")).toBe("eur");
    expect(body.get("line_items[0][price_data][unit_amount]")).toBe("97000");
  });
});

/* =========================================================================
 * A4 — textos de falha e erros do servidor nas cinco línguas
 * =======================================================================*/

describe("A4 — tela de pagamento indisponível traduzida", () => {
  const idiomas = ["pt", "en", "es", "fr", "de"] as const;
  it("todos os motivos existem nas cinco línguas, sem texto vazio", () => {
    for (const idioma of idiomas) {
      const t = TEXTOS_PAGAMENTO_INDISPONIVEL[idioma];
      for (const motivo of MOTIVOS_PAGAMENTO_INDISPONIVEL) {
        for (const campo of ["titulo", "texto", "detalhe"] as const) {
          expect(t.estados[motivo][campo].trim().length, `${idioma}.${motivo}.${campo}`).toBeGreaterThan(10);
        }
      }
      expect(t.pedido("REV-1")).toContain("REV-1");
      expect(t.diagnostico("REV-1", "erro_tecnico", SUPORTE_POR_MOTIVO.erro_tecnico)).toContain("erro_tecnico");
    }
  });
  it("nenhuma língua estrangeira repete o português", () => {
    const pt = TEXTOS_PAGAMENTO_INDISPONIVEL.pt;
    for (const idioma of ["en", "es", "fr", "de"] as const) {
      const t = TEXTOS_PAGAMENTO_INDISPONIVEL[idioma];
      for (const motivo of MOTIVOS_PAGAMENTO_INDISPONIVEL) {
        expect(t.estados[motivo].titulo).not.toBe(pt.estados[motivo].titulo);
        expect(t.estados[motivo].texto).not.toBe(pt.estados[motivo].texto);
        expect(t.estados[motivo].texto).not.toMatch(/Seu pedido|cobrado|Tente novamente/);
      }
      // "Número copiado" é igual em português e espanhol, de verdade.
      for (const chave of ["tentarNovamente", "verPedido", "copiarNumero", "avisoSuporte", "avisoContinuar", "infoSuporte", "quandoAbrir"] as const) {
        expect(t[chave]).not.toBe(pt[chave]);
      }
    }
  });
});

describe("A4 — erros do servidor internacional na língua da tela", () => {
  it("as cinco línguas têm as mesmas chaves e não repetem o português", async () => {
    const { ERROS_COTACAO } = await import("@/app/checkout/actions-internacional");
    const chaves = Object.keys(ERROS_COTACAO.pt).sort();
    for (const idioma of ["en", "es", "fr", "de"] as const) {
      expect(Object.keys(ERROS_COTACAO[idioma]).sort()).toEqual(chaves);
      for (const chave of chaves) {
        const valor = ERROS_COTACAO[idioma][chave as keyof typeof ERROS_COTACAO.pt];
        const ptValor = ERROS_COTACAO.pt[chave as keyof typeof ERROS_COTACAO.pt];
        const a = typeof valor === "function" ? valor(30) : valor;
        const b = typeof ptValor === "function" ? ptValor(30) : ptValor;
        expect(a, `${idioma}.${chave}`).not.toBe(b);
        expect(a).not.toMatch(/Não foi possível|Tente novamente/);
      }
    }
  });
});
