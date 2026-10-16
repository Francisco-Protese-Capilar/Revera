import { headers } from "next/headers";
import { Header } from "@/components/ui/Header";
import { Footer } from "@/components/ui/Footer";
import { aparenciaDoSite } from "@/lib/site/aparencia";
import { LOCALE_HEADER, normalizeSiteLocale } from "@/lib/i18n/site";
import { idiomaDoLayoutDoPedido } from "@/lib/i18n/pedido-layout";

// Template renova o idioma também nas navegações internas: o root layout
// é persistente no Next. O CartProvider permanece acima para preservar a sacola.
export default async function SiteTemplate({ children }: { children: React.ReactNode }) {
  const site = await aparenciaDoSite();
  const h = await headers();
  const locale = await idiomaDoLayoutDoPedido(h.get("x-revera-pedido-token"), normalizeSiteLocale(h.get(LOCALE_HEADER)) ?? "pt");
  return <>
    <Header locale={locale} logo={site.logoUrl} brandName={site.brandName}
      menuPrincipal={site.menuPrincipal} menuConheca={site.menuConheca} linkProfissionais={site.linkProfissionais} />
    <div className="flex-1">{children}</div>
    <Footer locale={locale} logo={site.logoUrl} brandName={site.brandName} instagramUrl={site.instagramUrl} />
  </>;
}
