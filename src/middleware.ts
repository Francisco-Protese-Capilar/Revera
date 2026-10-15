import { NextResponse, type NextRequest } from "next/server";
import {
  DEFAULT_SITE_LOCALE,
  GEO_COUNTRY_COOKIE,
  GEO_COUNTRY_HEADER,
  LOCALE_COOKIE,
  LOCALE_GEO_PENDING_COOKIE,
  LOCALE_MANUAL_COOKIE,
  LOCALE_HEADER,
  isFullyLocalizedPath,
  localeFromPath,
  localeManualDosCookies,
  stripLocaleFromPath,
  type SiteLocale,
} from "@/lib/i18n/site";
import {
  PAIS_ESCOLHIDO_COOKIE,
  PAIS_ESCOLHIDO_MAX_AGE_S,
  resolverIdiomaDaJornada,
  resolverPaisDeEntrega,
  type DestinoResolvido,
} from "@/lib/internacional/destino";

function paisDetectado(request: NextRequest): string | null {
  const pais = request.headers.get("x-vercel-ip-country")?.trim().toUpperCase();
  return pais && /^[A-Z]{2}$/.test(pais) && pais !== "XX" ? pais : null;
}

function registrarPais(response: NextResponse, request: NextRequest): NextResponse {
  const pais = paisDetectado(request);
  if (pais) {
    response.cookies.set(GEO_COUNTRY_COOKIE, pais, { path: "/", sameSite: "lax", maxAge: 60 * 60 * 24 });
  }
  return response;
}

/**
 * PAÍS ESCOLHIDO SOBREVIVE À JORNADA (15/10/2026, A1 da auditoria).
 *
 * Quem abre `/checkout?pais=GB` (aba de país, link de anúncio) escolheu o
 * destino. A escolha fica num cookie de um dia para o carrinho, a página de
 * produto e `/en/checkout` sem query continuarem no Reino Unido — e para o
 * idioma padrão (quando ninguém escolheu idioma) seguir o destino. Só grava
 * em carregamento de página de verdade, pela mesma razão do cookie de idioma:
 * pré-carga não é escolha.
 */
function gravarPaisEscolhido(response: NextResponse, destino: DestinoResolvido, gravaEscolha: boolean): NextResponse {
  if (gravaEscolha && destino.origem === "explicito") {
    response.cookies.set(PAIS_ESCOLHIDO_COOKIE, destino.iso, {
      path: "/",
      sameSite: "lax",
      maxAge: PAIS_ESCOLHIDO_MAX_AGE_S,
    });
  }
  return response;
}

/**
 * O destino que a PÁGINA vai resolver, calculado aqui com as mesmas funções,
 * para o `<html lang>` do layout (que lê LOCALE_HEADER) concordar com o
 * `<main lang>` do checkout.
 */
function destinoDaRequisicao(request: NextRequest, localeDaRota: SiteLocale | null): DestinoResolvido {
  // `?pais=` vale em qualquer página pública (checkout, produto, catálogo —
  // um anúncio pode apontar para `/en/produtos/x?pais=GB`): o país
  // conhecido vira a escolha da jornada.
  const explicito = request.nextUrl.searchParams.get("pais");
  return resolverPaisDeEntrega({
    explicito,
    escolhido: request.cookies.get(PAIS_ESCOLHIDO_COOKIE)?.value,
    detectado: paisDetectado(request),
    localeDaRota,
  });
}

function shouldIgnore(pathname: string): boolean {
  return (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/admin") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.[a-z0-9]+$/i.test(pathname)
  );
}

/**
 * PREFETCH NÃO É ESCOLHA DE IDIOMA (06/10/2026).
 *
 * O seletor PT/EN/ES/FR/DE do cabeçalho e as abas de país do checkout são
 * `<Link>`, e o Next pré-carrega cada um deles em segundo plano. Cada
 * pré-carga passava por aqui como se fosse uma visita a /en, /fr, /de... e
 * gravava `revera_locale` + `revera_locale_manual=1` por um ano. O último
 * pré-carregamento a terminar "vencia": um brasileiro que só abriu
 * /checkout saía com o cookie em inglês (ou francês, ou alemão, por sorteio
 * de rede), e a navegação seguinte sem prefixo era redirecionada para o
 * checkout internacional. Pior: o POST do "Finalizar pedido" (server action
 * em /checkout) também era redirecionado — 307 para /en/checkout.
 *
 * Regra: só uma navegação de verdade (GET/HEAD que não é pré-carga) grava a
 * escolha ou é redirecionada pelo idioma; pré-carga e POST passam direto.
 * As abas de país do checkout saem com `prefetch={false}` (o seletor de
 * idioma virou `<a>`, ver abaixo), para o clique sempre chegar ao servidor
 * (uma pré-carga que seguiu redirect deixava o Next reaproveitar a URL
 * errada e o clique em PT não pegava).
 */
function ehPreCarga(request: NextRequest): boolean {
  const purpose = `${request.headers.get("purpose") ?? ""} ${request.headers.get("sec-purpose") ?? ""}`;
  return request.headers.has("next-router-prefetch") || /prefetch/i.test(purpose);
}

/**
 * PAÍS EXPLÍCITO NO CHECKOUT VENCE O IDIOMA (Codex, 08/10/2026). As abas de
 * país e o "comprar para o Brasil" levam a /checkout?pais=XX. Com
 * geolocalização US ou cookie manual "en", a entrada sem prefixo era
 * redirecionada para /en/checkout?pais=XX — e a rota localizada ignora o
 * parâmetro e impõe o mercado americano. Quem escolheu o destino escolheu o
 * mercado: a página decide (US continua indo para /en/checkout por lá).
 */
function paisExplicitoNoCheckout(request: NextRequest): boolean {
  const { pathname, searchParams } = request.nextUrl;
  // Qualquer `?pais=` presente (válido ou não) fica com a página: um valor
  // desconhecido vira tela de indisponibilidade, não redirect para outro
  // mercado. Só o valor conhecido vira cookie (gravarPaisEscolhido).
  return pathname === "/checkout" && (searchParams.get("pais") ?? "").trim() !== "";
}

function ehLeitura(request: NextRequest): boolean {
  return request.method === "GET" || request.method === "HEAD";
}

/**
 * SÓ CARREGAMENTO DE PÁGINA GRAVA O IDIOMA (06/10/2026, depois do #4).
 *
 * Em produção o middleware NÃO recebe `next-router-prefetch` (curl com o
 * cabeçalho em /fr/checkout?_rsc=x ainda volta com Set-Cookie fr), então
 * `ehPreCarga()` sozinho não segura nada. Reproduzido: em /en, clicar em PT
 * abria "/" em português, mas pré-cargas de /en/... ainda em voo terminavam
 * depois e regravavam `revera_locale=en`; a próxima navegação sem prefixo
 * voltava para /en/produtos.
 *
 * O que distingue de verdade é `sec-fetch-dest`, que o navegador põe sozinho
 * e o Next não consegue mudar: `document` num carregamento de página, `empty`
 * em pré-carga e em navegação RSC. Sem o cabeçalho (curl, testes, navegador
 * muito antigo) conta como página. Por isso o seletor de idioma é um `<a>`
 * comum (carrega a página inteira), não `<Link>`.
 */
function ehCarregamentoDePagina(request: NextRequest): boolean {
  const destino = request.headers.get("sec-fetch-dest");
  return destino === null || destino === "document";
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (shouldIgnore(pathname)) return NextResponse.next();

  const navegacao = ehLeitura(request) && !ehPreCarga(request);
  const gravaEscolha = navegacao && ehCarregamentoDePagina(request);

  const localeInPath = localeFromPath(pathname);
  const cookie = (nome: string) => request.cookies.get(nome)?.value;

  if (!localeInPath) {
    // A entrada sem prefixo representa uma nova visita e segue o destino:
    // país escolhido nesta jornada (cookie de um dia) ou o país real
    // detectado na borda. Um cookie antigo de viagem/idioma não pode mandar
    // um comprador brasileiro de anúncio para /de ou /en — só a escolha
    // manual de idioma vence o destino.
    const localeManual = localeManualDosCookies(cookie);
    const destino = destinoDaRequisicao(request, null);
    const locale = resolverIdiomaDaJornada({
      localeDaRota: null,
      escolhaManual: localeManual !== null,
      localeManual,
      destino,
    });
    // Pré-carga não redireciona nem marca geolocalização pendente: o clique
    // de verdade é que decide, e chega sem o cabeçalho de pré-carga.
    if (
      navegacao &&
      locale !== DEFAULT_SITE_LOCALE &&
      isFullyLocalizedPath(pathname) &&
      !paisExplicitoNoCheckout(request)
    ) {
      const url = request.nextUrl.clone();
      url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
      const response = NextResponse.redirect(url);
      // Só marca "veio da geolocalização" num carregamento de página: o
      // /en/... que segue um redirect de pré-carga chega como `empty`, não
      // apagaria a marca, e um clique em idioma nos 60 s seguintes seria
      // gravado como geolocalização em vez de escolha.
      if (ehCarregamentoDePagina(request)) {
        response.cookies.set(LOCALE_GEO_PENDING_COOKIE, "1", {
          maxAge: 60,
          path: "/",
          sameSite: "lax",
        });
      }
      return registrarPais(response, request);
    }

    const requestHeaders = cabecalhosDaPagina(request, locale);
    return gravarPaisEscolhido(
      registrarPais(NextResponse.next({ request: { headers: requestHeaders } }), request),
      destino,
      gravaEscolha
    );
  }

  const strippedPath = stripLocaleFromPath(pathname);
  const veioDaGeolocalizacao = request.cookies.get(LOCALE_GEO_PENDING_COOKIE)?.value === "1";
  const url = request.nextUrl.clone();
  url.pathname = strippedPath;
  url.search = search;

  if (
    localeInPath === DEFAULT_SITE_LOCALE ||
    shouldIgnore(strippedPath) ||
    !isFullyLocalizedPath(strippedPath)
  ) {
    const response = NextResponse.redirect(url);
    if (gravaEscolha) gravarIdioma(response, localeInPath, veioDaGeolocalizacao);
    return registrarPais(response, request);
  }

  const requestHeaders = cabecalhosDaPagina(request, localeInPath);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (gravaEscolha) gravarIdioma(response, localeInPath, veioDaGeolocalizacao);
  return gravarPaisEscolhido(
    registrarPais(response, request),
    destinoDaRequisicao(request, localeInPath),
    gravaEscolha
  );
}

/** Idioma resolvido e país detectado seguem para a página pelos cabeçalhos. */
function cabecalhosDaPagina(request: NextRequest, locale: SiteLocale): Headers {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(LOCALE_HEADER, locale);
  const paisAtual = paisDetectado(request);
  if (paisAtual) requestHeaders.set(GEO_COUNTRY_HEADER, paisAtual);
  return requestHeaders;
}

function gravarIdioma(response: NextResponse, locale: string, veioDaGeolocalizacao: boolean) {
  response.cookies.set(LOCALE_COOKIE, locale, {
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
    sameSite: "lax",
  });
  if (veioDaGeolocalizacao) response.cookies.delete(LOCALE_GEO_PENDING_COOKIE);
  else {
    response.cookies.set(LOCALE_MANUAL_COOKIE, "1", {
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
      sameSite: "lax",
    });
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
