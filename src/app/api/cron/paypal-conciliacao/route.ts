import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { ACAO_PAYPAL_RETIDO, reavaliarCapturaPayPal } from "@/lib/payments/paypal-captura";
import { PayPalProvider } from "@/lib/payments/paypal-provider";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Conferência periódica dos pedidos PayPal pendentes (06/10/2026) e, desde
 * 24/10/2026, dos pagos que ainda não foram enviados.
 *
 * Rede de segurança do webhook: se um aviso do PayPal se perder (fora do ar,
 * assinatura recusada, evento não assinado), o pedido não fica "aguardando
 * pagamento" para sempre. A cada rodada, pedidos internacionais pendentes dos
 * últimos 7 dias com ordem PayPal passam por reavaliarCapturaPayPal(), que
 * pergunta ao PayPal e, se pago, confirma pelo caminho de sempre.
 *
 * Mesma porta fechada do carrinho abandonado: sem CRON_SECRET, 404.
 * Devolve 200 mesmo sem nada a fazer; erro vira log.
 */
const JANELA_DIAS = 7;
// Dá tempo ao fluxo normal (retorno do cliente + webhook) antes de conferir.
const MATURACAO_MINUTOS = 10;
const LIMITE_POR_RODADA = 25;
// Reserva ainda 'pending' depois disto é, quase sempre, checkout abandonado
// antes da aprovação: sai da fila para não tomar o lugar dos recentes.
// Captura RETIDA também fica 'pending', mas o webhook PENDING já avisou.
const PENDENTE_MAX_HORAS = 24;
// Fila longa (vendas retidas): lê até 100 marcas e embaralha a ordem a cada
// rodada. O corte de 45 s decide quantas cabem; com mais retidas do que
// cabem numa rodada, o embaralho garante que nenhuma fica de fora sempre.
const MARCAS_MAX = 100;
const RETIDOS_POR_RODADA = 15;
// Fila de pagos ainda não enviados (24/10/2026): um estorno ou chargeback cujo
// aviso se perdeu deixava o pedido 'paid' e despachável, porque esta
// conferência só olhava pendentes (achado do Codex, 08/10). Agora os pagos
// PayPal que ainda não saíram são reconferidos no PayPal por 30 dias.
// reavaliarCapturaPayPal não faz nada com pago + "concluída" (sem e-mail nem
// Purchase repetido); com estorno, marca 'refunded' e o despacho trava.
const PAGOS_JANELA_DIAS = 30;
const PAGOS_POR_RODADA = 10;
// Rodízio com progresso GRAVADO: um marcador em audit_logs guarda o último
// pagamento percorrido (created_at, id), e a rodada seguinte continua logo
// depois dele, só avançando pelo que foi de fato conferido. Se o tempo da rodada acabar no meio, a próxima continua de
// onde parou. Sorteio e relógio pulavam pedidos (revisões Codex, 24/10/2026).
const ACAO_CURSOR_PAGOS = "cron.paypal_pagos_cursor";
// Orçamento: retidos + pendentes usam até 30 s; os pagos têm até os 45 s.
const LIMITE_VENDAS_MS = 30_000;
const LIMITE_TOTAL_MS = 45_000;
// Timeout da consulta da ordem; quem protege os 60 s é o corte de 45 s no laço.
const TIMEOUT_POR_PEDIDO_MS = 8_000;

export async function GET(req: NextRequest) {
  const segredo = (process.env.CRON_SECRET ?? "").trim();
  if (!segredo || (req.headers.get("authorization") ?? "") !== `Bearer ${segredo}`) {
    return new NextResponse("Not Found", { status: 404 });
  }

  const supabase = createAdminClient();
  const agora = Date.now();
  const { data, error } = await supabase
    .from("payments")
    .select("order_id, provider_payment_id, orders!inner(payment_status, canceled_at, currency, created_at)")
    .eq("provider", "paypal")
    .or(
      `status.eq.approved,and(status.eq.pending,created_at.gte.${new Date(agora - PENDENTE_MAX_HORAS * 3_600_000).toISOString()})`
    )
    .not("provider_payment_id", "is", null)
    .eq("orders.payment_status", "pending")
    .is("orders.canceled_at", null)
    .neq("orders.currency", "BRL")
    .gte("orders.created_at", new Date(agora - JANELA_DIAS * 86_400_000).toISOString())
    .lte("orders.created_at", new Date(agora - MATURACAO_MINUTOS * 60_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(LIMITE_POR_RODADA);

  if (error) {
    console.error("[cron/paypal] falha ao ler pendentes", error.message);
    return NextResponse.json({ ok: false });
  }

  // Fila longa: capturas que o PayPal SEGUROU (marcadas no histórico por
  // reavaliarCapturaPayPal) continuam sendo conferidas por 7 dias, mesmo com
  // a reserva 'pending' passando das 24 h. Vêm primeiro: são vendas pagas.
  const { data: marcas, error: erroMarcas } = await supabase
    .from("audit_logs")
    .select("entity_id, diff")
    .eq("action", ACAO_PAYPAL_RETIDO)
    .gte("created_at", new Date(agora - JANELA_DIAS * 86_400_000).toISOString())
    .order("created_at", { ascending: false })
    .limit(MARCAS_MAX);
  if (erroMarcas) console.error("[cron/paypal] falha ao ler retidos", erroMarcas.message);
  // A ordem PayPal que estava retida vem da marca: se o pedido ganhou outra
  // ordem depois, a retida continua sendo a conferida.
  const ordemRetida = new Map<string, string | null>();
  for (const m of marcas ?? []) {
    const id = m.entity_id as string | null;
    if (!id || ordemRetida.has(id)) continue;
    const ordem = (m.diff as { ordem?: string } | null)?.ordem;
    ordemRetida.set(id, typeof ordem === "string" ? ordem : null);
  }
  const idsRetidos = [...ordemRetida.keys()];
  let retidosPendentes: string[] = [];
  if (idsRetidos.length > 0) {
    const { data: aindaPendentes, error: erroPendentes } = await supabase
      .from("orders")
      .select("id")
      .in("id", idsRetidos)
      .eq("payment_status", "pending")
      .is("canceled_at", null);
    if (erroPendentes) console.error("[cron/paypal] falha ao filtrar retidos", erroPendentes.message);
    // Até 15 por rodada: o resto do tempo fica para a fila normal.
    retidosPendentes = embaralhar((aindaPendentes ?? []).map((o) => o.id as string)).slice(0, RETIDOS_POR_RODADA);
  }

  // A ordem conferida é a do pagamento APROVADO: é ela que sustenta o 'paid'.
  const pagosElegiveis = () =>
    supabase
      .from("payments")
      .select("id, created_at, order_id, provider_payment_id, orders!inner(payment_status, canceled_at, currency, shipping_status, created_at)")
      .eq("provider", "paypal")
      .eq("status", "approved")
      .not("provider_payment_id", "is", null)
      .eq("orders.payment_status", "paid")
      .is("orders.canceled_at", null)
      .neq("orders.currency", "BRL")
      .not("orders.shipping_status", "in", "(shipped,delivered)")
      .gte("orders.created_at", new Date(agora - PAGOS_JANELA_DIAS * 86_400_000).toISOString())
      .order("created_at", { ascending: true })
      .order("id", { ascending: true });
  type Pago = { pagamentoId: string; criadoEm: string; orderId: string; paypalOrderId: string };
  const comoPago = (l: Record<string, unknown>): Pago => ({
    pagamentoId: l.id as string,
    criadoEm: l.created_at as string,
    orderId: l.order_id as string,
    paypalOrderId: l.provider_payment_id as string,
  });
  // Cursor = o último pagamento PERCORRIDO (created_at, id). A próxima rodada
  // começa logo depois dele; quem saiu da lista no meio-tempo (estornado,
  // enviado, cancelado) não desloca ninguém. No fim, dá a volta ao começo.
  const { data: marcador } = await supabase
    .from("audit_logs")
    .select("diff")
    .eq("action", ACAO_CURSOR_PAGOS)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const cursor = marcador?.diff as { created_at?: unknown; id?: unknown } | null;
  const cursorValido =
    typeof cursor?.created_at === "string" && typeof cursor?.id === "string" &&
    !Number.isNaN(Date.parse(cursor.created_at)) && /^[0-9a-f-]{36}$/i.test(cursor.id);
  const pagosNaoEnviados: Pago[] = [];
  {
    const depois = cursorValido
      ? await pagosElegiveis()
          .or(`created_at.gt."${cursor!.created_at}",and(created_at.eq."${cursor!.created_at}",id.gt.${cursor!.id})`)
          .limit(PAGOS_POR_RODADA)
      : await pagosElegiveis().limit(PAGOS_POR_RODADA);
    if (depois.error) console.error("[cron/paypal] falha ao ler pagos não enviados", depois.error.message);
    pagosNaoEnviados.push(...(depois.data ?? []).map((l) => comoPago(l as Record<string, unknown>)));
    if (cursorValido && !depois.error && pagosNaoEnviados.length < PAGOS_POR_RODADA) {
      const volta = await pagosElegiveis().limit(PAGOS_POR_RODADA - pagosNaoEnviados.length);
      if (volta.error) console.error("[cron/paypal] falha ao ler pagos não enviados", volta.error.message);
      const ja = new Set(pagosNaoEnviados.map((p) => p.pagamentoId));
      for (const l of volta.data ?? []) {
        const p = comoPago(l as Record<string, unknown>);
        if (!ja.has(p.pagamentoId)) pagosNaoEnviados.push(p);
      }
    }
  }

  // Vendas a confirmar primeiro, com teto de tempo; os pagos têm o resto.
  const vendas: Array<{ orderId: string; paypalOrderId: string | null }> = [
    ...retidosPendentes.map((orderId) => ({ orderId, paypalOrderId: ordemRetida.get(orderId) ?? null })),
    ...(data ?? []).map((l) => ({ orderId: l.order_id as string, paypalOrderId: l.provider_payment_id as string })),
  ];

  // Uma instância só: o token OAuth é guardado por instância.
  const paypal = new PayPalProvider();
  const inicio = Date.now();
  const vistos = new Set<string>();
  const resultados: Record<string, number> = {};
  const conferir = async (orderId: string, paypalOrderId: string | null) => {
    vistos.add(orderId);
    const r = await reavaliarCapturaPayPal(
      orderId,
      { eventId: null, paypalOrderId },
      paypal,
      { timeoutMs: TIMEOUT_POR_PEDIDO_MS }
    );
    resultados[r.estado] = (resultados[r.estado] ?? 0) + 1;
  };
  for (const { orderId, paypalOrderId } of vendas) {
    if (vistos.has(orderId)) continue;
    if (Date.now() - inicio > LIMITE_VENDAS_MS) break; // a próxima rodada continua
    await conferir(orderId, paypalOrderId);
  }
  // Avança o marcador só até o último pago que esta rodada de fato percorreu.
  let ultimo: Pago | null = null;
  for (const pago of pagosNaoEnviados) {
    if (Date.now() - inicio > LIMITE_TOTAL_MS) break;
    if (!vistos.has(pago.orderId)) await conferir(pago.orderId, pago.paypalOrderId);
    ultimo = pago;
  }
  if (ultimo) {
    const { error: erroCursor } = await supabase.from("audit_logs").insert({
      admin_user_id: null,
      action: ACAO_CURSOR_PAGOS,
      entity_type: "cron",
      entity_id: "paypal-pagos",
      diff: { created_at: ultimo.criadoEm, id: ultimo.pagamentoId },
    });
    if (erroCursor) console.error("[cron/paypal] não gravou o marcador dos pagos", erroCursor.message);
  }

  console.info("[cron/paypal]", JSON.stringify({ pedidos: vistos.size, resultados }));
  return NextResponse.json({ ok: true, pedidos: vistos.size, resultados }, { headers: { "cache-control": "no-store" } });
}

function embaralhar<T>(lista: T[]): T[] {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j] as T, copia[i] as T];
  }
  return copia;
}
