import { notFound } from "next/navigation";
import { checkoutLocalizado } from "@/app/checkout/checkout-do-pais";
import { normalizeSiteLocale } from "@/lib/i18n/site";

/**
 * `/en/checkout`, `/es/checkout`, `/fr/checkout`, `/de/checkout`.
 *
 * Até 15/10/2026 esta rota impunha o mercado pelo idioma (EN → EUA), e a
 * troca de idioma em `/checkout?pais=GB` trocava o destino. Agora o idioma
 * da rota só traduz; o país vem de `?pais=`, do cookie da jornada ou da
 * geolocalização, e o mercado do idioma é apenas o último recurso.
 */
export default async function CheckoutLocalizado({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ pais?: string }>;
}) {
  const locale = normalizeSiteLocale((await params).locale);
  if (!locale || locale === "pt") notFound();
  const { pais } = await searchParams;
  return checkoutLocalizado(locale, pais);
}
