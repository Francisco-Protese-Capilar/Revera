import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { renderProdutoInternacional } from "./carregar";
import { normalizeSiteLocale, localizePath } from "@/lib/i18n/site";
import { produtoTraduzido } from "@/lib/i18n/produtos";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale: rawLocale, slug } = await params;
  const locale = normalizeSiteLocale(rawLocale);
  if (!locale || locale === "pt") return {};
  const translated = produtoTraduzido(slug, locale, "Revera hair system");
  const url = localizePath(`/produtos/${slug}`, locale);
  return {
    title: translated.nome,
    description: translated.descricao,
    alternates: { canonical: url, languages: { "pt-BR": `/produtos/${slug}`, "en-US": `/en/produtos/${slug}`, "es-ES": `/es/produtos/${slug}`, "fr-FR": `/fr/produtos/${slug}`, "de-DE": `/de/produtos/${slug}` } },
    openGraph: { title: `${translated.nome} — Reverá`, description: translated.descricao, url },
    twitter: {
      card: "summary_large_image",
      title: `${translated.nome} — Reverá`,
      description: translated.descricao,
      images: ["/media/hero/produto-close-1.jpeg"],
    },
  };
}

export default async function ProdutoLocalizado({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<{ pais?: string }>;
}) {
  const { locale: rawLocale, slug } = await params;
  const locale = normalizeSiteLocale(rawLocale);
  if (!locale || locale === "pt") notFound();
  const { pais } = await searchParams;
  return renderProdutoInternacional(slug, locale, pais);
}
