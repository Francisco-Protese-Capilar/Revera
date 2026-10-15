import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { converterCentavosBrl, obterCotacaoPtax } from "@/lib/internacional/cambio-ptax";
import { ProdutoInternacional, type VarianteInternacional } from "./ProdutoInternacional";
import type { SiteLocale } from "@/lib/i18n/site";
import { produtoTraduzido } from "@/lib/i18n/produtos";
import type { Moeda } from "@/lib/internacional/moeda";
import { mercadoDaVitrine } from "@/lib/internacional/destino-server";
import { nomeDoPais } from "@/lib/internacional/paises";

/**
 * Página de produto para entrega FORA do Brasil (ou Brasil lido em outra
 * língua), em qualquer idioma — inclusive português sem prefixo, quando o
 * destino da jornada é internacional (Portugal, ou quem escolheu outro país
 * e voltou ao português). Compartilhada entre `/[locale]/produtos/[slug]` e
 * `/produtos/[slug]` para a precificação ser uma só.
 */
export async function renderProdutoInternacional(slug: string, locale: SiteLocale, paisExplicito?: string | null) {
  // Moeda pelo PAÍS DE ENTREGA da jornada, não pelo idioma (15/10/2026):
  // um britânico lendo em inglês vê libra, não dólar. Brasil (quem escolheu
  // outra língua mas compra para cá) mantém o preço BRL nacional.
  const { iso: isoDoMercado, regra: regraDoMercado, nacional, aberto } = await mercadoDaVitrine(locale, paisExplicito);
  const mercado = { moeda: regraDoMercado.moedaPadrao as Moeda, moneyLocale: regraDoMercado.locale };
  // Destino conhecido que o checkout ainda não atende: a página existe, sem
  // preço e sem "adicionar" — nunca a moeda de outro mercado.
  const semPreco = !aberto;

  const supabase = await createClient();
  const { data: product } = await supabase
    .from("products")
    .select("id, slug, name, description, product_variants(id, color_id, price_cents, stock_qty, is_active), product_media(url, type, is_primary, sort_order)")
    .eq("slug", slug)
    .maybeSingle();
  if (!product) notFound();

  const active = (product.product_variants ?? []).filter(
    (variant) => variant.is_active && Number(variant.price_cents) > 0 && Number(variant.stock_qty) > 0
  );
  const ids = active.map((variant) => variant.id as string);
  const [{ data: prices }, { data: colors }, quote] = await Promise.all([
    // Brasil usa a MESMA regra de variante vendável da vitrine nacional
    // (`is_active && price_cents > 0 && stock_qty > 0`, já aplicada em
    // `active`); variant_prices é elegibilidade de EXPORTAÇÃO, não do Brasil.
    nacional || semPreco
      ? Promise.resolve({ data: ids.map((variant_id) => ({ variant_id })) })
      : supabase.from("variant_prices").select("variant_id").in("variant_id", ids).eq("currency", mercado.moeda).eq("is_active", true).gt("price_cents", 0),
    supabase.from("colors").select("id, code, name, photo_url").in("id", active.map((variant) => variant.color_id).filter(Boolean)),
    nacional || semPreco ? Promise.resolve(null) : obterCotacaoPtax(mercado.moeda).catch(() => null),
  ]);
  if (!nacional && !semPreco && !quote) notFound();

  const approved = new Set((prices ?? []).map((price) => price.variant_id as string));
  const colorById = new Map((colors ?? []).map((color) => [color.id as string, color]));
  const variants: VarianteInternacional[] = active
    .filter((variant) => approved.has(variant.id as string))
    .map((variant) => {
      const color = variant.color_id ? colorById.get(variant.color_id as string) : null;
      const priceBrlCents = variant.price_cents as number;
      return {
        id: variant.id as string,
        colorId: (variant.color_id as string | null) ?? null,
        colorCode: (color?.code as string | null) ?? null,
        colorName: (color?.name as string | null) ?? null,
        colorPhotoUrl: (color?.photo_url as string | null) ?? null,
        stockQty: variant.stock_qty as number,
        priceBrlCents,
        priceCents: semPreco ? 0 : nacional || !quote ? priceBrlCents : converterCentavosBrl(priceBrlCents, quote.reaisPorUnidade),
      };
    });
  if (variants.length === 0) notFound();

  const image = (product.product_media ?? [])
    .filter((media) => (media.type ?? "image") === "image")
    .sort((a, b) => Number(Boolean(b.is_primary)) - Number(Boolean(a.is_primary)) || Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0))[0];

  const translated = produtoTraduzido(slug, locale, product.name as string, product.description as string | null);
  return (
    <ProdutoInternacional
      name={translated.nome}
      description={translated.descricao}
      imageUrl={(image?.url as string | undefined) ?? null}
      variants={variants}
      locale={locale}
      currency={mercado.moeda}
      moneyLocale={mercado.moneyLocale}
      mercadoNacional={nacional}
      mercadoFechadoPara={semPreco ? nomeDoPais(isoDoMercado, locale) : null}
    />
  );
}
