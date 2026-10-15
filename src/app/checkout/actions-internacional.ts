"use server";

/**
 * Criação do pedido INTERNACIONAL — irmã de criarPedidoAction (actions.ts),
 * deliberadamente um arquivo separado: o caminho brasileiro paga as contas
 * e não pode herdar risco de refactor internacional. O que é idêntico
 * (trava de duplo clique, IDs gerados aqui, atribuição, preço nunca do
 * navegador) segue o mesmo desenho; o que difere está comentado.
 *
 * Diferenças de fundo:
 *  - preço vem de variant_prices NA MOEDA do mercado (nunca convertido,
 *    nunca com a escada de desconto brasileira) — precosDoCarrinhoNoMercado;
 *  - frete vem de cotação DHL em tempo real para o endereço informado; o
 *    comprador vê e confirma o total antes de qualquer pedido nascer;
 *  - endereço valida por validarEndereco() (única porta de validação
 *    internacional), não pelo schema brasileiro;
 *  - o pedido só nasce com o ACEITE internacional marcado, e grava
 *    terms_version + terms_accepted_at (relógio do servidor);
 *  - imposto NÃO entra no total (tax_cents = 0): estrutura §4 — nada de
 *    calcular imposto sem integrador confiável.
 */
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { consumirLimiteDhlCompartilhado } from "@/lib/http/limite-dhl-compartilhado";
import {
  emitirConfirmacaoCotacao,
  hashCheckout,
  validarConfirmacaoCotacao,
} from "@/lib/internacional/cotacao-confirmacao";
import {
  devolverCarrinhoParaAberto,
  lerCarrinhoCompleto,
  reivindicarCarrinhoParaPedido,
} from "@/lib/cart/store";
import { limparTokenDoCookie } from "@/lib/cart/token";
import { createAdminClient } from "@/lib/supabase/server";
import { paraLinha, validarEndereco } from "@/lib/internacional/endereco";
import {
  precosDoCarrinhoNoMercado,
  prontidaoDoMercado,
} from "@/lib/internacional/mercado";
import { ACEITE_INTERNACIONAL_VERSAO } from "@/lib/internacional/aceite";
import { cotacaoDhlPermitida, origemCotacaoDhl } from "@/lib/internacional/ambiente-cotacao";
import { idiomaDoPais } from "@/lib/internacional/paises";
import { textos, type Idioma } from "@/lib/internacional/idioma";
import { isSiteLocale } from "@/lib/i18n/site";

/**
 * Mensagens de erro que o comprador lê, nas cinco línguas (A4 da auditoria
 * de 15/10/2026: várias ficavam fixas em português). `mercadoFechado` não
 * repete `mercado.motivo`, que é diagnóstico interno em português.
 */
export const ERROS_COTACAO: Record<Idioma, {
  indisponivel: string;
  limite: (segundos: number) => string;
  mudou: string;
  manual: string;
  meioIndisponivel: string;
  mercadoFechado: string;
  cambio: string;
  dhlEndereco: string;
  dhlServico: string;
  dhlAmbiente: string;
  assinatura: string;
  gravarCotacao: string;
  criarPedido: string;
  registrarItens: string;
}> = {
  pt: {
    indisponivel: "A consulta de frete está temporariamente indisponível. Tente novamente mais tarde.",
    limite: (s) => `Muitas consultas de frete. Aguarde ${s} segundos e tente novamente.`,
    mudou: "A cotação expirou ou mudou na nova consulta da DHL. Confira as condições atualizadas e confirme novamente.",
    manual: "Este carrinho precisa de uma cotação DHL feita pela nossa equipe.",
    meioIndisponivel: "Este meio de pagamento não está disponível agora.",
    mercadoFechado: "Não foi possível concluir: as vendas para este destino não estão disponíveis no momento.",
    cambio: "Não foi possível calcular o câmbio agora. Tente novamente em instantes.",
    dhlEndereco: "A DHL não conseguiu calcular o frete para este endereço agora. Confira os dados ou tente novamente.",
    dhlServico: "A DHL não retornou um serviço de envio compatível para este endereço.",
    dhlAmbiente: "O frete internacional está temporariamente indisponível para pagamento.",
    assinatura: "Não foi possível validar a cotação. Tente novamente em instantes.",
    gravarCotacao: "Não foi possível confirmar a cotação DHL. Tente novamente.",
    criarPedido: "Não foi possível criar o pedido agora. Tente novamente em instantes.",
    registrarItens: "Não foi possível registrar os itens do pedido. Tente novamente.",
  },
  en: {
    indisponivel: "Shipping quotes are temporarily unavailable. Please try again later.",
    limite: (s) => `Too many shipping quote requests. Wait ${s} seconds and try again.`,
    mudou: "The quote expired or changed after the DHL recheck. Review the updated shipping conditions and confirm again.",
    manual: "This cart requires a DHL quote prepared by our team.",
    meioIndisponivel: "This payment method is not available right now.",
    mercadoFechado: "We could not complete this: sales to this destination are not available at the moment.",
    cambio: "We could not calculate the exchange rate right now. Please try again in a moment.",
    dhlEndereco: "DHL could not calculate shipping for this address right now. Check the details or try again.",
    dhlServico: "DHL did not return a compatible shipping service for this address.",
    dhlAmbiente: "International shipping is temporarily unavailable for payment.",
    assinatura: "We could not validate the quote. Please try again in a moment.",
    gravarCotacao: "We could not confirm the DHL quote. Please try again.",
    criarPedido: "We could not create the order right now. Please try again in a moment.",
    registrarItens: "We could not register the order items. Please try again.",
  },
  es: {
    indisponivel: "Las cotizaciones de envío no están disponibles temporalmente. Inténtalo más tarde.",
    limite: (s) => `Hay demasiadas consultas de envío. Espera ${s} segundos e inténtalo de nuevo.`,
    mudou: "La cotización venció o cambió al volver a consultar DHL. Revisa las condiciones actualizadas y confirma de nuevo.",
    manual: "Este carrito necesita una cotización DHL preparada por nuestro equipo.",
    meioIndisponivel: "Este medio de pago no está disponible ahora.",
    mercadoFechado: "No fue posible concluir: las ventas a este destino no están disponibles en este momento.",
    cambio: "No fue posible calcular el cambio ahora. Inténtalo de nuevo en unos instantes.",
    dhlEndereco: "DHL no pudo calcular el envío para esta dirección ahora. Revisa los datos o inténtalo de nuevo.",
    dhlServico: "DHL no devolvió un servicio de envío compatible para esta dirección.",
    dhlAmbiente: "El envío internacional no está disponible temporalmente para el pago.",
    assinatura: "No fue posible validar la cotización. Inténtalo de nuevo en unos instantes.",
    gravarCotacao: "No fue posible confirmar la cotización DHL. Inténtalo de nuevo.",
    criarPedido: "No fue posible crear el pedido ahora. Inténtalo de nuevo en unos instantes.",
    registrarItens: "No fue posible registrar los artículos del pedido. Inténtalo de nuevo.",
  },
  fr: {
    indisponivel: "Les tarifs de livraison sont temporairement indisponibles. Réessayez plus tard.",
    limite: (s) => `Trop de demandes de tarif. Attendez ${s} secondes puis réessayez.`,
    mudou: "Le tarif a expiré ou changé après la nouvelle vérification DHL. Vérifiez les conditions mises à jour et confirmez à nouveau.",
    manual: "Ce panier nécessite un tarif DHL préparé par notre équipe.",
    meioIndisponivel: "Ce moyen de paiement n’est pas disponible pour le moment.",
    mercadoFechado: "Impossible de finaliser : les ventes vers cette destination ne sont pas disponibles pour le moment.",
    cambio: "Impossible de calculer le taux de change pour le moment. Réessayez dans un instant.",
    dhlEndereco: "DHL n’a pas pu calculer la livraison pour cette adresse. Vérifiez les informations ou réessayez.",
    dhlServico: "DHL n’a renvoyé aucun service de livraison compatible pour cette adresse.",
    dhlAmbiente: "La livraison internationale est temporairement indisponible pour le paiement.",
    assinatura: "Impossible de valider le tarif. Réessayez dans un instant.",
    gravarCotacao: "Impossible de confirmer le tarif DHL. Réessayez.",
    criarPedido: "Impossible de créer la commande pour le moment. Réessayez dans un instant.",
    registrarItens: "Impossible d’enregistrer les articles de la commande. Réessayez.",
  },
  de: {
    indisponivel: "Versandangebote sind vorübergehend nicht verfügbar. Versuchen Sie es später erneut.",
    limite: (s) => `Zu viele Versandanfragen. Warten Sie ${s} Sekunden und versuchen Sie es erneut.`,
    mudou: "Das Angebot ist abgelaufen oder hat sich nach der erneuten DHL-Prüfung geändert. Prüfen Sie die aktualisierten Bedingungen und bestätigen Sie erneut.",
    manual: "Für diesen Warenkorb muss unser Team ein DHL-Angebot erstellen.",
    meioIndisponivel: "Diese Zahlungsmethode ist derzeit nicht verfügbar.",
    mercadoFechado: "Abschluss nicht möglich: Verkäufe in dieses Zielland sind derzeit nicht verfügbar.",
    cambio: "Der Wechselkurs konnte gerade nicht berechnet werden. Versuchen Sie es in Kürze erneut.",
    dhlEndereco: "DHL konnte den Versand für diese Adresse gerade nicht berechnen. Prüfen Sie die Angaben oder versuchen Sie es erneut.",
    dhlServico: "DHL hat keinen passenden Versandservice für diese Adresse zurückgegeben.",
    dhlAmbiente: "Der internationale Versand ist vorübergehend nicht für die Zahlung verfügbar.",
    assinatura: "Das Angebot konnte nicht validiert werden. Versuchen Sie es in Kürze erneut.",
    gravarCotacao: "Das DHL-Angebot konnte nicht bestätigt werden. Versuchen Sie es erneut.",
    criarPedido: "Die Bestellung konnte gerade nicht angelegt werden. Versuchen Sie es in Kürze erneut.",
    registrarItens: "Die Artikel der Bestellung konnten nicht gespeichert werden. Versuchen Sie es erneut.",
  },
};
import { obterCotacaoPtax } from "@/lib/internacional/cambio-ptax";
import { cotarDhlOperacional } from "@/lib/shipping/dhl/admin-quote";
import type { DhlQuote } from "@/lib/shipping/dhl/types";
import { avisarPedidoPendentePorEmail } from "@/lib/notificacoes/email-operacional";
import type { CheckoutResult } from "./actions";
import { provedoresInternacionaisDisponiveis } from "@/lib/payments/revera";

const textoCurto = z.string().max(500).nullable().optional().catch(null);

/**
 * Fábrica por idioma, pela mesma razão de `endereco.ts`: a mensagem de erro
 * é texto que o comprador lê, e quem compra dos EUA lê inglês.
 */
function construirSchema(idioma: Idioma) {
  const t = textos(idioma);
  return z.object({
  trackingConsent: z.boolean().optional().default(false),
  pais: z.string().trim().min(2).max(2).transform((v) => v.toUpperCase()),
  name: z.string().trim().min(3, t.erroNome),
  email: z
    .string()
    .trim()
    .email(t.erroEmail)
    .transform((v) => v.toLowerCase()),
  telefone: z.string().trim().min(1, t.erroTelefone),
  empresa: z.string().trim().nullable().default(null),
  linha1: z.string().trim().min(1, t.erroEnderecoObrigatorio),
  linha2: z.string().trim().nullable().default(null),
  cidade: z.string().trim().min(1, t.erroCidadeObrigatoria),
  regiao: z.string().trim().nullable().default(null),
  // Alguns destinos não têm código postal. A validação de endereço decide
  // se ele é obrigatório conforme o país, depois de ler o payload.
  codigoPostal: z.string().trim().default(""),
  /** O aceite só é exigido na confirmação que pode criar o pedido. */
  aceite: z.boolean().optional().default(false),
  atribuicao: z
    .object({
      fbp: textoCurto,
      fbc: textoCurto,
      gaClientId: textoCurto,
      fbclid: textoCurto,
      gclid: textoCurto,
      utmSource: textoCurto,
      utmMedium: textoCurto,
      utmCampaign: textoCurto,
      utmContent: textoCurto,
      utmTerm: textoCurto,
      metaCampaignId: textoCurto,
    })
    .nullable()
    .optional()
    .catch(null),
  confirmarCotacao: z.string().min(20).max(4096).optional().nullable(),
  paymentPreference: z.enum(["stripe", "paypal"]),
  /**
   * Idioma em que a tela foi lida (15/10/2026). Só escolhe a língua das
   * mensagens; país, moeda e preço continuam vindo do destino validado.
   */
  idioma: z.enum(["pt", "en", "es", "fr", "de"]).optional(),
  });
}

const SCHEMAS = new Map<Idioma, ReturnType<typeof construirSchema>>();

function schemaDoIdioma(idioma: Idioma) {
  let schema = SCHEMAS.get(idioma);
  if (!schema) {
    schema = construirSchema(idioma);
    SCHEMAS.set(idioma, schema);
  }
  return schema;
}

const schemaInternacional = schemaDoIdioma("pt");

export type CheckoutInternacionalInput = z.input<typeof schemaInternacional>;

/**
 * O país é lido do payload CRU, antes de validar, só para escolher a língua
 * das mensagens. Não é confiança: nada é aceito por causa disso — o país
 * volta a ser validado pelo schema e de novo por `validarEndereco`. Um
 * payload adulterado no máximo recebe a recusa na língua errada.
 */
function idiomaDoPayload(input: unknown): Idioma {
  if (typeof input !== "object" || input === null) return "pt";
  // Idioma da jornada (escolha manual ou prefixo da rota) vence o padrão do
  // país: quem leu o formulário em francês com entrega na Alemanha recebe o
  // erro em francês. Valor fora da lista cai no idioma do país.
  const idiomaBruto = (input as { idioma?: unknown }).idioma;
  if (typeof idiomaBruto === "string" && isSiteLocale(idiomaBruto)) return idiomaBruto;
  if (!("pais" in input)) return "pt";
  const bruto = (input as { pais: unknown }).pais;
  return idiomaDoPais(typeof bruto === "string" ? bruto : "BR");
}

function gerarNumeroPedido(): string {
  return `REV-${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export async function criarPedidoInternacionalAction(
  input: unknown
): Promise<CheckoutResult> {
  const idioma = idiomaDoPayload(input);
  const t = textos(idioma);
  const parsed = schemaDoIdioma(idioma).safeParse(input);
  if (!parsed.success) {
    const camposComErro: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const campo = issue.path[0];
      if (typeof campo === "string" && !camposComErro[campo]) {
        camposComErro[campo] = issue.message;
      }
    }
    return { erro: t.erroConfiraCampos, camposComErro };
  }
  const dados = parsed.data;
  if (dados.confirmarCotacao && !dados.aceite) {
    return { erro: t.aceiteObrigatorio };
  }
  const gatewaysDisponiveis = await provedoresInternacionaisDisponiveis();
  if (!gatewaysDisponiveis.includes(dados.paymentPreference)) {
    return { erro: t.erroConfiraCampos, camposComErro: { paymentPreference: ERROS_COTACAO[idioma].meioIndisponivel } };
  }

  // A única porta de validação de endereço internacional — inclui a regra
  // por país (código postal, região obrigatória onde for).
  const endereco = validarEndereco({
    pais: dados.pais,
    destinatario: dados.name,
    empresa: dados.empresa,
    linha1: dados.linha1,
    linha2: dados.linha2,
    cidade: dados.cidade,
    regiao: dados.regiao,
    codigoPostal: dados.codigoPostal,
    telefone: dados.telefone,
  });
  if (!endereco.ok) {
    const camposComErro: Record<string, string> = {};
    for (const e of endereco.erros) {
      if (e.campo && !camposComErro[e.campo]) camposComErro[e.campo] = e.mensagem;
    }
    return { erro: t.erroConfiraCampos, camposComErro };
  }
  if (endereco.endereco.pais === "BR") {
    return { erro: t.erroEnderecoBrasileiro };
  }
  const linha = paraLinha(endereco.endereco);

  /**
   * Prontidão RECONFERIDA aqui, não herdada da tela: gateway, país aberto
   * e cotação de frete vigente. A tela pode ter ficado aberta por horas —
   * a cotação pode ter VENCIDO nesse meio-tempo, e um frete vencido não
   * congela num pedido novo.
   */
  const mercado = await prontidaoDoMercado(dados.pais);
  if (!mercado.aberto) {
    console.error("[checkout-intl] mercado fechado na confirmação", { pais: dados.pais, motivo: mercado.motivo });
    return { erro: ERROS_COTACAO[idioma].mercadoFechado };
  }

  const carrinho = await lerCarrinhoCompleto();
  if (!carrinho.cartId || carrinho.items.length === 0) {
    return { erro: t.sacolaVazia };
  }

  let cambio;
  try {
    cambio = await obterCotacaoPtax(mercado.moeda);
  } catch (erro) {
    console.error("[checkout-intl] falha ao obter PTAX", erro);
    return { erro: ERROS_COTACAO[idioma].cambio };
  }

  // A linha ativa em variant_prices funciona como autorização de exportação;
  // o preço vem do BRL atual do carrinho convertido pela PTAX de venda.
  const precos = await precosDoCarrinhoNoMercado(
    carrinho.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity, basePriceCents: i.basePriceCents })),
    mercado.moeda,
    cambio
  );
  if (!precos.ok) {
    return {
      erro:
        t.semPrecoNoMercado,
    };
  }

  const quantidadeTotal = carrinho.items.reduce((soma, item) => soma + item.quantity, 0);
  // Cada prótese ocupa a embalagem operacional de 20×19×9 cm e 1 kg
  // tarifável. Para várias unidades, empilhamos a altura e somamos o peso;
  // acima de 10 volumes o checkout para, pois exige embalagem manual.
  if (quantidadeTotal < 1 || quantidadeTotal > 10) {
    return { erro: ERROS_COTACAO[idioma].manual };
  }

  const cabecalhos = await headers();
  const limiteCotacao = await consumirLimiteDhlCompartilhado(cabecalhos, carrinho.cartId);
  if (!limiteCotacao.permitido) {
    return {
      erro: limiteCotacao.indisponivel
        ? ERROS_COTACAO[idioma].indisponivel
        : ERROS_COTACAO[idioma].limite(limiteCotacao.retryAfterSeconds),
    };
  }

  let cotacaoDhl: Awaited<ReturnType<typeof cotarDhlOperacional>>;
  try {
    cotacaoDhl = await cotarDhlOperacional({
      country: endereco.endereco.pais,
      postalCode: linha.postal_code,
      cityName: endereco.endereco.cidade,
      provinceCode: linha.region,
      addressLine1: linha.line1,
      currency: mercado.moeda,
      declaredValueCents: precos.subtotalCents,
      // Embalagem operacional já usada pela Reverá para uma prótese.
      weightGrams: 1000 * quantidadeTotal,
      lengthCm: 20,
      widthCm: 19,
      heightCm: 9 * quantidadeTotal,
    });
  } catch (erro) {
    console.error("[checkout-intl] falha ao cotar DHL", {
      errorName: erro instanceof Error ? erro.name : "unknown",
    });
    return { erro: ERROS_COTACAO[idioma].dhlEndereco };
  }
  const escolher = (quotes: DhlQuote[]) =>
    quotes.find((q) => q.productCode === "8" && q.currency === mercado.moeda) ??
    quotes.find((q) => q.productCode === "P" && q.currency === mercado.moeda);
  const frete = escolher(cotacaoDhl.quotes);
  if (!frete || frete.priceCents <= 0) {
    return { erro: ERROS_COTACAO[idioma].dhlServico };
  }
  if (!cotacaoDhlPermitida(cotacaoDhl.ambiente)) {
    console.error("[checkout-intl] ambiente da cotação DHL incompatível com o checkout");
    return { erro: ERROS_COTACAO[idioma].dhlAmbiente };
  }

  const subtotalCents = precos.subtotalCents;
  const shippingCents = frete.priceCents;
  const taxCents = 0;
  const totalCents = subtotalCents + shippingCents + taxCents;
  const cotacao = {
    currency: mercado.moeda,
    subtotalCents,
    shippingCents,
    totalCents,
    serviceName: frete.productName,
    etaDays: frete.etaDays,
    deliveryDate: frete.deliveryDate ?? null,
  };
  const enderecamentoHash = hashCheckout({
    pais: endereco.endereco.pais,
    linha1: linha.line1,
    linha2: linha.line2,
    cidade: linha.city,
    regiao: linha.region,
    codigoPostal: linha.postal_code,
    empresa: linha.company,
  });
  const carrinhoHash = hashCheckout(carrinho.items
    .map((item) => ({
      variantId: item.variantId,
      quantity: item.quantity,
      basePriceCents: item.basePriceCents,
      productName: item.productName,
      variantLabel: item.variantLabel,
    }))
    .sort((a, b) => a.variantId.localeCompare(b.variantId)));
  const payloadConfirmacao = {
    cartId: carrinho.cartId,
    carrinhoHash,
    enderecoHash: enderecamentoHash,
    moeda: mercado.moeda,
    subtotalCentavos: subtotalCents,
    freteCentavos: shippingCents,
    totalCentavos: totalCents,
    codigoServico: frete.productCode,
    nomeServico: frete.productName,
    prazoDias: frete.etaDays,
    dataEntrega: frete.deliveryDate ?? null,
    termosVersao: ACEITE_INTERNACIONAL_VERSAO,
  };
  let tokenCotacao: string;
  try {
    tokenCotacao = emitirConfirmacaoCotacao(payloadConfirmacao);
  } catch {
    console.error("[checkout-intl] não foi possível assinar a cotação", { errorCode: "signing-key-unavailable" });
    return { erro: ERROS_COTACAO[idioma].assinatura };
  }
  const cotacaoComToken = { ...cotacao, token: tokenCotacao };

  // Primeiro mostramos a tarifa ao comprador sem criar pedido, reserva ou
  // cobrança. Na confirmação, o servidor recota e compara os valores.
  const confirmada = dados.confirmarCotacao;
  if (!confirmada) return { cotacao: cotacaoComToken };
  const snapshotConfirmado = validarConfirmacaoCotacao(confirmada);
  const cotacaoConfere = snapshotConfirmado &&
    snapshotConfirmado.cartId === payloadConfirmacao.cartId &&
    snapshotConfirmado.carrinhoHash === payloadConfirmacao.carrinhoHash &&
    snapshotConfirmado.enderecoHash === payloadConfirmacao.enderecoHash &&
    snapshotConfirmado.moeda === payloadConfirmacao.moeda &&
    snapshotConfirmado.subtotalCentavos === payloadConfirmacao.subtotalCentavos &&
    snapshotConfirmado.freteCentavos === payloadConfirmacao.freteCentavos &&
    snapshotConfirmado.totalCentavos === payloadConfirmacao.totalCentavos &&
    snapshotConfirmado.codigoServico === payloadConfirmacao.codigoServico &&
    snapshotConfirmado.nomeServico === payloadConfirmacao.nomeServico &&
    snapshotConfirmado.prazoDias === payloadConfirmacao.prazoDias &&
    snapshotConfirmado.dataEntrega === payloadConfirmacao.dataEntrega &&
    snapshotConfirmado.termosVersao === payloadConfirmacao.termosVersao;
  if (!cotacaoConfere) {
    return {
      erro: ERROS_COTACAO[idioma].mudou,
      cotacao: cotacaoComToken,
    };
  }

  // Trava do duplo clique — idêntica ao nacional, mesma função.
  if (!(await reivindicarCarrinhoParaPedido(carrinho.cartId))) {
    return {
      erro:
        t.erroPedidoEmAndamento,
    };
  }

  const admin = createAdminClient();
  let pedidoPersistido = false;
  const quoteId = randomUUID();
  const customerId = randomUUID();

  async function falhar(mensagem: string): Promise<CheckoutResult> {
    // Depois que o pedido existe, reabrir o carrinho permitiria criar um
    // segundo pedido pagável para a mesma compra. Mantemos a trava e o
    // pedido fica fail-closed para reconciliação operacional.
    if (!pedidoPersistido) {
      // IDs são gerados antes das inserções: apagar por eles é seguro tanto
      // quando a linha existe quanto quando a inserção falhou antes de criar.
      const [{ error: erroQuote }, { error: erroCustomer }] = await Promise.all([
        admin.from("shipping_quotes").delete().eq("id", quoteId),
        admin.from("customers").delete().eq("id", customerId),
      ]);
      if (!erroQuote && !erroCustomer) {
        await devolverCarrinhoParaAberto(carrinho.cartId as string);
      } else {
        console.error("[checkout-intl] limpeza pré-pedido incompleta; carrinho mantido travado", {
          quote: erroQuote?.code,
          customer: erroCustomer?.code,
        });
      }
    }
    return { erro: mensagem };
  }

  const reciboDhl = {
    source: origemCotacaoDhl(cotacaoDhl.ambiente),
    environment: cotacaoDhl.ambiente,
    country: endereco.endereco.pais,
    currency: mercado.moeda,
    product_code: frete.productCode,
    service_name: frete.productName,
    eta_days: frete.etaDays,
    delivery_date: frete.deliveryDate ?? null,
    quoted_at: new Date().toISOString(),
    exchange_rate: cambio.reaisPorUnidade,
    exchange_rate_source: cambio.fonte,
    exchange_rate_date: cambio.data,
    package: { quantity: quantidadeTotal, weight_grams: 1000 * quantidadeTotal, length_cm: 20, width_cm: 19, height_cm: 9 * quantidadeTotal },
  };
  const { error: erroCotacaoInicial } = await admin.from("shipping_quotes").insert({
    id: quoteId,
    order_id: null,
    cart_id: carrinho.cartId,
    service_name: frete.productName,
    carrier: "DHL",
    price_cents: frete.priceCents,
    eta_days: frete.etaDays,
    raw_response: reciboDhl,
  });
  if (erroCotacaoInicial) {
    console.error("[checkout-intl] falha ao gravar cotação DHL", erroCotacaoInicial);
    return falhar(ERROS_COTACAO[idioma].gravarCotacao);
  }

  const { error: erroCustomer } = await admin.from("customers").insert({
    id: customerId,
    full_name: dados.name,
    email: dados.email,
    phone: endereco.endereco.telefone,
    // Cliente internacional NÃO tem CPF — e não se inventa identificação
    // fiscal: foreign_tax_id só entra quando o cliente informar (fase
    // fiscal, com o contador). Nulo é o valor honesto hoje.
    cpf: null,
    country: endereco.endereco.pais,
  });
  if (erroCustomer) {
    return falhar(t.erroRegistrarDados);
  }

  const addressId = randomUUID();
  const { error: erroAddress } = await admin.from("addresses").insert({
    id: addressId,
    customer_id: customerId,
    recipient_name: dados.name,
    country: endereco.endereco.pais,
    company: linha.company,
    line1: linha.line1,
    line2: linha.line2,
    city: linha.city,
    region: linha.region,
    postal_code: linha.postal_code,
  });
  if (erroAddress) {
    return falhar(t.erroRegistrarEndereco);
  }

  // tax_cents = 0 NÃO significa "sem imposto no destino" — significa "a
  // Reverá não cobrou imposto no checkout" (estrutura §4). O aviso e o
  // aceite comunicam a diferença ao cliente.

  const encadeado = cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim();
  const atribuicao = {
    fbp: dados.atribuicao?.fbp ?? null,
    fbc: dados.atribuicao?.fbc ?? null,
    ga_client_id: dados.atribuicao?.gaClientId ?? null,
    fbclid: dados.atribuicao?.fbclid ?? null,
    gclid: dados.atribuicao?.gclid ?? null,
    utm_source: dados.atribuicao?.utmSource ?? null,
    utm_medium: dados.atribuicao?.utmMedium ?? null,
    utm_campaign: dados.atribuicao?.utmCampaign ?? null,
    utm_content: dados.atribuicao?.utmContent ?? null,
    utm_term: dados.atribuicao?.utmTerm ?? null,
    meta_campaign_id: dados.atribuicao?.metaCampaignId ?? null,
    client_ip: cabecalhos.get("x-real-ip") ?? encadeado ?? null,
    user_agent: cabecalhos.get("user-agent")?.slice(0, 500) ?? null,
  };

  const orderId = randomUUID();
  const accessToken = randomUUID();

  async function desfazerPedidoParcial(mensagem: string): Promise<CheckoutResult> {
    // Compensação explícita: order_items e quote ligada caem por cascade;
    // customer remove o endereço. Só reabrimos o carrinho se TODA a
    // compensação confirmou sucesso, evitando pedido duplicado.
    const { error: erroOrder } = await admin.from("orders").delete().eq("id", orderId);
    const [{ error: erroQuote }, { error: erroCustomer }] = erroOrder
      ? [{ error: null }, { error: null }]
      : await Promise.all([
          admin.from("shipping_quotes").delete().eq("id", quoteId),
          admin.from("customers").delete().eq("id", customerId),
        ]);
    if (!erroOrder && !erroQuote && !erroCustomer) {
      pedidoPersistido = false;
      await devolverCarrinhoParaAberto(carrinho.cartId as string);
    } else {
      console.error("[checkout-intl] compensação incompleta; carrinho mantido travado", {
        orderId,
        order: erroOrder?.code,
        quote: erroQuote?.code,
        customer: erroCustomer?.code,
      });
    }
    return { erro: mensagem };
  }

  let orderNumber = gerarNumeroPedido();
  let pedidoCriado = false;
  for (let tentativa = 0; tentativa < 3 && !pedidoCriado; tentativa += 1) {
    const { error } = await admin.from("orders").insert({
      id: orderId,
      order_number: orderNumber,
      access_token: accessToken,
      customer_id: customerId,
      address_id: addressId,
      currency: mercado.moeda,
      // Idioma da tela em que o pedido nasceu (item 2, 15/10/2026).
      locale: idioma,
      subtotal_cents: subtotalCents,
      discount_cents: 0,
      shipping_cents: shippingCents,
      tax_cents: taxCents,
      total_cents: totalCents,
      payment_preference: dados.paymentPreference,
      tracking_consent: dados.trackingConsent,
      export_status: "pending_data",
      // O aceite: versão + instante do SERVIDOR. O navegador só disse
      // "true"; quem data é a gente.
      terms_version: ACEITE_INTERNACIONAL_VERSAO,
      terms_accepted_at: new Date().toISOString(),
      intl_shipping_quote_id: null,
      shipping_quote_id: quoteId,
      exchange_rate: cambio.reaisPorUnidade,
      exchange_rate_source: cambio.fonte,
      exchange_rate_date: cambio.data,
      ...atribuicao,
    });

    if (!error) {
      pedidoCriado = true;
      pedidoPersistido = true;
    } else if (error.code === "23505") {
      orderNumber = gerarNumeroPedido();
    } else {
      console.error("[checkout-intl] falha ao criar pedido", error);
      return falhar(ERROS_COTACAO[idioma].criarPedido);
    }
  }
  if (!pedidoCriado) {
    return falhar(ERROS_COTACAO[idioma].criarPedido);
  }

  const porVariante = new Map(precos.itens.map((i) => [i.variantId, i]));
  const itensPayload = carrinho.items.map((item) => {
    const preco = porVariante.get(item.variantId);
    return {
      id: randomUUID(),
      order_id: orderId,
      variant_id: item.variantId,
      product_name_snapshot: item.productName,
      variant_label_snapshot: item.variantLabel,
      unit_price_cents: preco?.unitPriceCents ?? 0,
      quantity: item.quantity,
      subtotal_cents: preco?.subtotalCents ?? 0,
    };
  });

  const { error: erroItens } = await admin.from("order_items").insert(itensPayload);
  if (erroItens) {
    console.error("[checkout-intl] falha ao registrar itens", {
      code: erroItens.code,
      message: erroItens.message,
    });
    return desfazerPedidoParcial(ERROS_COTACAO[idioma].registrarItens);
  }

  const { error: erroCotacao } = await admin.from("shipping_quotes")
    .update({ order_id: orderId }).eq("id", quoteId).is("order_id", null)
    .select("id").single();
  if (erroCotacao) {
    console.error("[checkout-intl] falha ao gravar recibo DHL", erroCotacao);
    return desfazerPedidoParcial(ERROS_COTACAO[idioma].gravarCotacao);
  }

  const avisoEmail = await avisarPedidoPendentePorEmail({
    orderId,
    orderNumber,
    cliente: dados.name,
    totalCents,
    moeda: mercado.moeda,
    origem: "checkout internacional",
    cidade: dados.cidade,
    pais: endereco.endereco.pais,
  });
  if (avisoEmail.estado === "erro") {
    console.error("[checkout-intl-email] falha ao avisar pedido pendente", {
      orderId,
      motivo: avisoEmail.motivo,
    });
  }

  await limparTokenDoCookie();

  redirect(`/checkout/pagamento?pedido=${accessToken}`);
}
