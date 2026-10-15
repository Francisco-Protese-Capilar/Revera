import Link from "next/link";
import { cookies, headers } from "next/headers";
import { CheckoutForm } from "./CheckoutForm";
import { CheckoutInternacionalForm, type ResumoInternacional } from "./CheckoutInternacionalForm";
import { HEADER_HEIGHT_PX } from "@/lib/layout/header";
import { lerCarrinhoCompleto } from "@/lib/cart/store";
import { aceiteInternacional } from "@/lib/internacional/aceite";
import { precosDoCarrinhoNoMercado, prontidaoDoMercado } from "@/lib/internacional/mercado";
import {
  bandeira,
  nomeDoPais,
  paisesDoCheckout,
  regraDoPais,
} from "@/lib/internacional/paises";
import { LANG_HTML, textos, type Idioma } from "@/lib/internacional/idioma";
import { GEO_COUNTRY_COOKIE, GEO_COUNTRY_HEADER, localeManualDosCookies, type SiteLocale } from "@/lib/i18n/site";
import {
  PAIS_ESCOLHIDO_COOKIE,
  hrefDoCheckoutDoPais,
  resolverIdiomaDaJornada,
  resolverPaisDeEntrega,
} from "@/lib/internacional/destino";
import { produtoTraduzido } from "@/lib/i18n/produtos";
import { provedoresInternacionaisDisponiveis, reveraApplePayDisponivel } from "@/lib/payments/revera";
import { obterCotacaoPtax } from "@/lib/internacional/cambio-ptax";

/**
 * PAÍS E IDIOMA SÃO DUAS PERGUNTAS (15/10/2026, auditoria do checkout).
 *
 * Destino: `?pais=` válido → país escolhido nesta jornada (cookie gravado
 * pelo middleware) → país detectado, quando conhecido → mercado padrão do
 * idioma da rota → Brasil. Um destino conhecido mas fechado é preservado
 * para prontidaoDoMercado() mostrar a indisponibilidade fail-closed; jamais
 * vira checkout BRL em silêncio. Geolocalização nunca vence uma escolha.
 *
 * Idioma: prefixo da rota → escolha manual no seletor → idioma padrão do
 * destino. Ele traduz a tela e vai ao gateway; não muda moeda, preço nem
 * país. O middleware calcula o mesmo valor para o `<html lang>`.
 */
export async function renderCheckout({
  localeDaRota,
  paisExplicito,
}: {
  localeDaRota: SiteLocale | null;
  paisExplicito: string | undefined;
}) {
  const paises = paisesDoCheckout();
  const cabecalhos = await headers();
  const cookieStore = await cookies();
  const destino = resolverPaisDeEntrega({
    explicito: paisExplicito,
    escolhido: cookieStore.get(PAIS_ESCOLHIDO_COOKIE)?.value,
    detectado:
      cabecalhos.get(GEO_COUNTRY_HEADER) ??
      cabecalhos.get("x-vercel-ip-country") ??
      cookieStore.get(GEO_COUNTRY_COOKIE)?.value,
    localeDaRota,
  });
  const pais = destino.iso;
  const localeManual = localeManualDosCookies((nome) => cookieStore.get(nome)?.value);
  const idioma: Idioma = resolverIdiomaDaJornada({
    localeDaRota,
    escolhaManual: localeManual !== null,
    localeManual,
    destino,
  });
  const t = textos(idioma);

  let conteudo: React.ReactNode;

  if (pais === "BR") {
    const carrinho = await lerCarrinhoCompleto();
    const applePayDisponivel = await reveraApplePayDisponivel();
    conteudo = (
      <CheckoutForm
        carrinhoInicial={carrinho}
        applePayDisponivel={applePayDisponivel}
      />
    );
  } else {
    conteudo = await checkoutInternacional(pais, idioma, localeDaRota);
  }

  return (
    <main
      // `lang` no <main>, e não no <html>: o layout raiz é compartilhado com
      // a loja inteira em português e mexer nele para traduzir o checkout
      // poria a venda nacional em risco. O atributo é válido em qualquer
      // elemento, e é o que faz o leitor de tela pronunciar em inglês.
      lang={LANG_HTML[idioma]}
      className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 pb-16"
      style={{ paddingTop: HEADER_HEIGHT_PX + 32 }}
    >
      <div className="flex flex-col gap-2">
        <span className="eyebrow-ink">{t.checkoutEyebrow}</span>
        <h1 className="font-display text-3xl text-ink">{t.checkoutTitulo}</h1>
      </div>

      {paises.length > 1 ? (
        <nav aria-label={t.navPaisLabel} className="flex flex-wrap gap-2">
          {paises.map((iso) => (
            <Link
              key={iso}
              href={hrefDoCheckoutDoPais(iso, localeDaRota)}
              prefetch={false}
              className={`rounded-full border px-4 py-2 text-sm ${
                iso === pais
                  ? "border-ink bg-ink text-paper"
                  : "border-sand bg-paper text-ink"
              }`}
            >
              {bandeira(iso)} {nomeDoPais(iso, idioma)}
            </Link>
          ))}
        </nav>
      ) : null}

      {conteudo}
    </main>
  );
}

async function checkoutInternacional(pais: string, idioma: Idioma, localeDaRota: SiteLocale | null): Promise<React.ReactNode> {
  const regra = regraDoPais(pais);
  const t = textos(idioma);
  const mercado = await prontidaoDoMercado(pais);

  if (!regra || !mercado.aberto) {
    // `mercado.motivo` vem do servidor em português: é diagnóstico de
    // operação ("cotação vencida", "sem preço"), não texto de vitrine.
    // Traduzir motivo por motivo criaria duas listas para manter — e o
    // comprador não precisa do detalhe, precisa saber que não dá hoje.
    return (
      <IndisponivelInternacional
        pais={pais}
        idioma={idioma}
        localeDaRota={localeDaRota}
        motivo={mensagemDeBloqueio(mercado.aberto ? undefined : mercado.codigo, idioma)}
      />
    );
  }

  const carrinho = await lerCarrinhoCompleto();
  if (!carrinho.cartId || carrinho.items.length === 0) {
    return <p className="max-w-2xl text-ink/70">{t.sacolaVazia}</p>;
  }

  let precos;
  try {
    const cambio = await obterCotacaoPtax(mercado.moeda);
    precos = await precosDoCarrinhoNoMercado(
      carrinho.items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        basePriceCents: item.basePriceCents,
      })),
      mercado.moeda,
      cambio
    );
  } catch {
    precos = { ok: false as const, semPreco: carrinho.items.map((item) => item.variantId) };
  }
  if (!precos.ok) {
    return <IndisponivelInternacional pais={pais} idioma={idioma} localeDaRota={localeDaRota} motivo={t.semPrecoNoMercado} />;
  }
  const precoPorVariante = new Map(precos.itens.map((item) => [item.variantId, item]));

  const aceite = aceiteInternacional(idioma);
  const gateways = await provedoresInternacionaisDisponiveis();
  if (gateways.length === 0) {
    return <IndisponivelInternacional pais={pais} idioma={idioma} localeDaRota={localeDaRota} motivo={mensagemDeBloqueio("pagamento", idioma)} />;
  }
  const resumo: ResumoInternacional = {
    idioma,
    locale: regra.locale,
    pais: {
      iso: regra.iso,
      nome: nomeDoPais(regra.iso, idioma),
      ddi: regra.ddi,
      exigeRegiao: regra.exigeRegiao,
      exigeCodigoPostal: regra.exigeCodigoPostal !== false,
      rotuloRegiao: regra.rotuloRegiao,
      rotuloPostal: regra.rotuloPostal,
      postalExemplo: regra.postalExemplo,
    },
    moeda: mercado.moeda,
    gateways,
    itens: carrinho.items.map((item) => ({
      variantId: item.variantId,
      nome: produtoTraduzido(item.productSlug, idioma, item.productName).nome,
      quantidade: item.quantity,
      precoUnitarioCents: precoPorVariante.get(item.variantId)?.unitPriceCents ?? 0,
    })),
    subtotalCents: precos.subtotalCents,
    avisoImpostosTitulo: aceite.avisoTitulo,
    avisoImpostosTexto: aceite.avisoTexto,
    aceiteTexto: aceite.aceite,
  };

  return (
    <div className="flex flex-col gap-6">
      <section className="max-w-2xl rounded-lg border border-sand bg-paper p-4 text-sm text-ink/80">
        <h2 className="mb-2 font-display text-lg text-ink">
          {t.envioPorTitulo("DHL")}
        </h2>
        <ul className="list-inside list-disc space-y-1 text-xs leading-relaxed">
          <li>{t.envioBulletPortaAPorta}</li>
          <li>{t.envioBulletPrazo}</li>
          <li>{t.envioBulletImpostos}</li>
        </ul>
      </section>
      <CheckoutInternacionalForm resumo={resumo} />
    </div>
  );
}

function mensagemDeBloqueio(codigo: string | undefined, idioma: Idioma): string {
  const mensagens = {
    pt: { frete: "Ainda não há cotação DHL vigente para este destino. O pagamento está indisponível.", precos: "Os preços deste mercado ainda estão em preparação. O pagamento está indisponível.", pagamento: "O pagamento internacional está indisponível no momento. Tente novamente mais tarde.", pais: "As vendas para este destino ainda não estão disponíveis." },
    en: { frete: "There is no valid DHL shipping quote for this destination yet. Payment is unavailable.", precos: "Prices for this market are still being prepared. Payment is unavailable.", pagamento: "International payment is currently unavailable. Please try again later.", pais: "Sales to this destination are not available yet." },
    es: { frete: "Todavía no hay una cotización DHL vigente para este destino. El pago no está disponible.", precos: "Los precios de este mercado todavía están en preparación. El pago no está disponible.", pagamento: "El pago internacional no está disponible en este momento. Inténtalo más tarde.", pais: "Las ventas a este destino todavía no están disponibles." },
    fr: { frete: "Aucun tarif DHL valide n’est encore disponible pour cette destination. Le paiement est indisponible.", precos: "Les prix pour ce marché sont encore en préparation. Le paiement est indisponible.", pagamento: "Le paiement international est actuellement indisponible. Réessayez plus tard.", pais: "Les ventes vers cette destination ne sont pas encore disponibles." },
    de: { frete: "Für dieses Ziel liegt noch kein gültiges DHL-Angebot vor. Die Zahlung ist nicht verfügbar.", precos: "Die Preise für diesen Markt werden noch vorbereitet. Die Zahlung ist nicht verfügbar.", pagamento: "Die internationale Zahlung ist derzeit nicht verfügbar. Versuchen Sie es später erneut.", pais: "Verkäufe in dieses Zielland sind noch nicht verfügbar." },
  };
  const chave = codigo && codigo in mensagens[idioma] ? codigo as keyof typeof mensagens.pt : "pais";
  return mensagens[idioma][chave];
}

function IndisponivelInternacional({ pais, idioma, localeDaRota, motivo }: { pais: string; idioma: Idioma; localeDaRota: SiteLocale | null; motivo: string }) {
  const t = textos(idioma);
  return (
    <div
      lang={LANG_HTML[idioma]}
      className="max-w-2xl rounded-lg border border-sand bg-paper p-6"
    >
      <h2 className="font-display text-xl text-ink">
        {bandeira(pais)} {t.indisponivelTitulo(nomeDoPais(pais, idioma))}
      </h2>
      <p className="mt-2 text-sm text-ink/70">{motivo}</p>
      <p className="mt-4 text-sm text-ink/70">{t.indisponivelAlternativa}</p>
      <Link href={hrefDoCheckoutDoPais("BR", localeDaRota)} prefetch={false} className="mt-4 inline-block text-sm text-ink underline">
        {t.indisponivelLinkBR}
      </Link>
    </div>
  );
}
