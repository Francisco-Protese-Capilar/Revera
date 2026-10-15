"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useCart } from "@/components/cart/CartProvider";
import { Button } from "@/components/ui/Button";
import { QuantitySelector } from "@/components/ui/QuantitySelector";
import { HEADER_HEIGHT_PX } from "@/lib/layout/header";
import { medirAdicionarAoCarrinho, medirVerProduto } from "@/lib/tracking/browser";
import { localizePath, type SiteLocale } from "@/lib/i18n/site";
import { formatarDinheiroParaComprador, type Moeda } from "@/lib/internacional/moeda";

export interface VarianteInternacional {
  id: string;
  colorId: string | null;
  colorCode: string | null;
  colorName: string | null;
  colorPhotoUrl: string | null;
  stockQty: number;
  priceBrlCents: number;
  priceCents: number;
}

const COPY: Record<SiteLocale, {
  priceFrom: string; eyebrow: string; choose: string; standard: string; selectError: string; addError: string; shipping: string;
  adding: string; add: string; added: string; checkout: string; payment: string; dhl: string; checked: string;
}> = {
  pt: { priceFrom: "A partir de", eyebrow: "Prótese capilar Reverá", choose: "Escolha a sua cor", standard: "Padrão", selectError: "Escolha a cor antes de continuar.", addError: "Não conseguimos adicionar este item. Tente novamente.", shipping: "O frete é calculado ao vivo pela DHL a partir do seu endereço de entrega no checkout. Impostos e taxas de importação, se cobrados, são pagos pelo destinatário.", adding: "Adicionando…", add: "Adicionar à sacola", added: "Adicionado à sua sacola.", checkout: "Continuar para o checkout", payment: "Pagamento internacional seguro", dhl: "Envio DHL rastreado a partir do Brasil", checked: "Cor e peça conferidas antes do envio" },
  en: { priceFrom: "From", eyebrow: "Revera hair system", choose: "Choose your color", standard: "Standard", selectError: "Choose your color before continuing.", addError: "We could not add this item. Please try again.", shipping: "Shipping is calculated live by DHL from your delivery address at checkout. Import duties and taxes, if charged, are paid by the recipient.", adding: "Adding…", add: "Add to cart", added: "Added to your cart.", checkout: "Continue to checkout", payment: "Secure international payment", dhl: "Tracked DHL shipping from Brazil", checked: "Color and item checked before dispatch" },
  es: { priceFrom: "Desde", eyebrow: "Prótesis capilar Reverá", choose: "Elige tu color", standard: "Estándar", selectError: "Elige el color antes de continuar.", addError: "No pudimos añadir este producto. Inténtalo de nuevo.", shipping: "El envío se calcula en vivo con DHL según tu dirección. Los aranceles e impuestos de importación, si se aplican, son responsabilidad del destinatario.", adding: "Añadiendo…", add: "Añadir al carrito", added: "Producto añadido al carrito.", checkout: "Continuar al pago", payment: "Pago internacional seguro", dhl: "Envío DHL rastreado desde Brasil", checked: "Color y producto revisados antes del envío" },
  fr: { priceFrom: "À partir de", eyebrow: "Prothèse capillaire Reverá", choose: "Choisissez votre couleur", standard: "Standard", selectError: "Choisissez la couleur avant de continuer.", addError: "Impossible d’ajouter cet article. Réessayez.", shipping: "La livraison est calculée en direct par DHL selon votre adresse. Les droits et taxes d’importation éventuels restent à la charge du destinataire.", adding: "Ajout…", add: "Ajouter au panier", added: "Article ajouté au panier.", checkout: "Continuer vers le paiement", payment: "Paiement international sécurisé", dhl: "Livraison DHL suivie depuis le Brésil", checked: "Couleur et article vérifiés avant expédition" },
  de: { priceFrom: "Ab", eyebrow: "Reverá Haarsystem", choose: "Farbe auswählen", standard: "Standard", selectError: "Wählen Sie vor dem Fortfahren eine Farbe.", addError: "Der Artikel konnte nicht hinzugefügt werden. Versuchen Sie es erneut.", shipping: "Der Versand wird im Checkout anhand Ihrer Adresse live von DHL berechnet. Eventuelle Einfuhrabgaben und Steuern trägt der Empfänger.", adding: "Wird hinzugefügt…", add: "In den Warenkorb", added: "Zum Warenkorb hinzugefügt.", checkout: "Weiter zur Kasse", payment: "Sichere internationale Zahlung", dhl: "DHL-Versand mit Tracking aus Brasilien", checked: "Farbe und Artikel vor Versand geprüft" },
};

/**
 * Quem lê em inglês/espanhol/francês/alemão mas compra para o BRASIL
 * (15/10/2026): o preço é o nacional em BRL e o frete não é DHL. Só os
 * trechos que falavam de envio internacional mudam; o resto do texto é o
 * mesmo.
 */
const COPY_FECHADO: Record<SiteLocale, { aviso: (pais: string) => string; escolher: string }> = {
  pt: { aviso: (pais) => `As vendas para ${pais} ainda não estão disponíveis. Escolha um país de entrega atendido e o preço aparece.`, escolher: "Escolher país de entrega" },
  en: { aviso: (pais) => `Sales to ${pais} are not available yet. Choose a delivery country we ship to and the price will appear.`, escolher: "Choose delivery country" },
  es: { aviso: (pais) => `Las ventas a ${pais} todavía no están disponibles. Elige un país de entrega atendido y el precio aparecerá.`, escolher: "Elegir país de entrega" },
  fr: { aviso: (pais) => `Les ventes vers ${pais} ne sont pas encore disponibles. Choisissez un pays de livraison desservi et le prix s’affichera.`, escolher: "Choisir le pays de livraison" },
  de: { aviso: (pais) => `Verkäufe nach ${pais} sind noch nicht verfügbar. Wählen Sie ein beliefertes Zielland, dann erscheint der Preis.`, escolher: "Zielland wählen" },
};

const COPY_NACIONAL: Record<SiteLocale, Pick<(typeof COPY)["en"], "shipping" | "payment" | "dhl">> = {
  pt: { shipping: "O frete dentro do Brasil é calculado no checkout a partir do seu CEP.", payment: "Pagamento seguro por Pix ou cartão", dhl: "Envio rastreado dentro do Brasil" },
  en: { shipping: "Shipping within Brazil is calculated at checkout from your postal code (CEP).", payment: "Secure payment by Pix or card", dhl: "Tracked shipping within Brazil" },
  es: { shipping: "El envío dentro de Brasil se calcula en el checkout según tu código postal (CEP).", payment: "Pago seguro por Pix o tarjeta", dhl: "Envío rastreado dentro de Brasil" },
  fr: { shipping: "La livraison au Brésil est calculée au paiement à partir de votre code postal (CEP).", payment: "Paiement sécurisé par Pix ou carte", dhl: "Livraison suivie au Brésil" },
  de: { shipping: "Der Versand innerhalb Brasiliens wird im Checkout anhand Ihrer Postleitzahl (CEP) berechnet.", payment: "Sichere Zahlung per Pix oder Karte", dhl: "Versand mit Tracking innerhalb Brasiliens" },
};

export function ProdutoInternacional({
  name,
  description,
  imageUrl,
  variants,
  locale,
  currency,
  moneyLocale,
  mercadoNacional = false,
  mercadoFechadoPara = null,
}: {
  name: string;
  description: string | null;
  imageUrl: string | null;
  variants: VarianteInternacional[];
  locale: SiteLocale;
  currency: Moeda;
  moneyLocale: string;
  /** Entrega no Brasil lida em outra língua: preço BRL, frete nacional. */
  mercadoNacional?: boolean;
  /**
   * Nome do destino conhecido que o checkout ainda não atende. Com ele, a
   * página não mostra preço nem "adicionar": convida a escolher outro país.
   */
  mercadoFechadoPara?: string | null;
}) {
  const copy = mercadoNacional ? { ...COPY[locale], ...COPY_NACIONAL[locale] } : COPY[locale];
  const { adicionarItem, pendente } = useCart();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState(false);
  const viewed = useRef(false);
  const selected = useMemo(
    () => variants.find((variant) => variant.id === selectedId) ?? null,
    [selectedId, variants]
  );
  // O preço precisa aparecer ANTES de a pessoa escolher a cor (15/10/2026:
  // a página em inglês mostrava só nome, cores e "Add to cart", sem valor).
  // Sem cor escolhida mostra o menor preço do modelo; se os preços das cores
  // diferem, com o prefixo "a partir de".
  // Só preços válidos (inteiro finito > 0) entram na conta: uma conversão
  // de câmbio inválida não pode virar "NaN" na tela (Codex, 15/10/2026).
  const precosValidos = useMemo(
    () =>
      variants
        .map((variant) => variant.priceCents)
        .filter((cents) => Number.isInteger(cents) && cents > 0),
    [variants]
  );
  const menorPrecoCents = precosValidos.length ? Math.min(...precosValidos) : null;
  const precosIguais = precosValidos.every((cents) => cents === menorPrecoCents);
  const precoExibidoCents =
    selected && Number.isInteger(selected.priceCents) && selected.priceCents > 0
      ? selected.priceCents
      : menorPrecoCents;

  useEffect(() => {
    if (viewed.current || variants.length === 0) return;
    viewed.current = true;
    const first = variants[0];
    if (!first) return;
    medirVerProduto({
      variantId: first.id,
      nome: name,
      quantidade: 1,
      precoUnitarioCents: first.priceCents,
      currency,
    });
  }, [currency, name, variants]);

  async function addToCart() {
    setError(null);
    setAdded(false);
    if (!selected) {
      setError(copy.selectError);
      return;
    }
    const result = await adicionarItem(selected.id, quantity);
    if (result.erro) {
      setError(copy.addError);
      return;
    }
    medirAdicionarAoCarrinho({
      variantId: selected.id,
      nome: name,
      quantidade: quantity,
      precoUnitarioCents: selected.priceCents,
      currency,
    });
    setAdded(true);
  }

  return (
    <main
      lang={moneyLocale}
      className="mx-auto w-full max-w-5xl px-6 pb-20"
      style={{ paddingTop: HEADER_HEIGHT_PX + 32 }}
    >
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-sand">
          {imageUrl ? (
            <Image src={imageUrl} alt={name} fill priority sizes="(min-width: 1024px) 50vw, 100vw" className="object-cover" />
          ) : null}
        </div>

        <section className="flex flex-col gap-6">
          <div>
            <span className="eyebrow-ink">{copy.eyebrow}</span>
            <h1 className="mt-2 font-display text-4xl text-ink">{name}</h1>
            <p className="mt-3 text-ink/70">
              {description}
            </p>
          </div>

          {mercadoFechadoPara ? (
            <div role="status" data-testid="mercado-fechado" className="rounded-xl border border-gold/45 bg-gold/10 p-4">
              <p className="text-sm leading-6 text-ink/80">{COPY_FECHADO[locale].aviso(mercadoFechadoPara)}</p>
              <Link href={localizePath("/checkout", locale)} className="mt-3 inline-block text-sm font-semibold text-ink underline">
                {COPY_FECHADO[locale].escolher}
              </Link>
            </div>
          ) : null}

          {precoExibidoCents !== null && !mercadoFechadoPara ? (
            <div className="rounded-xl border border-sand p-4" data-testid="preco-internacional">
              <p className="font-display text-3xl font-semibold text-ink">
                {!selected && !precosIguais ? (
                  <span className="mr-2 text-base font-normal text-ink/60">{copy.priceFrom}</span>
                ) : null}
                {formatarDinheiroParaComprador(precoExibidoCents, currency, moneyLocale)}
              </p>
              <p className="mt-1 text-xs text-ink/60">
                {copy.shipping}
              </p>
            </div>
          ) : null}

          <div>
            <h2 className="text-sm font-semibold text-ink">{copy.choose}</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {variants.map((variant) => (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedId(variant.id)}
                  className={`flex items-center gap-3 rounded-lg border p-3 text-left ${
                    selectedId === variant.id ? "border-gold bg-gold/10" : "border-sand bg-paper"
                  }`}
                >
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-sand">
                    {variant.colorPhotoUrl ? (
                      <Image src={variant.colorPhotoUrl} alt="" fill sizes="40px" className="object-cover" />
                    ) : null}
                  </span>
                  <span className="text-sm font-medium text-ink">
                    {variant.colorCode || variant.colorName || copy.standard}
                  </span>
                </button>
              ))}
            </div>
          </div>


          {mercadoFechadoPara ? null : (
            <div className="flex items-center gap-4">
              <QuantitySelector value={quantity} onChange={setQuantity} max={selected?.stockQty} />
              <Button size="lg" className="flex-1" disabled={pendente || !selected} onClick={() => void addToCart()}>
                {pendente ? copy.adding : copy.add}
              </Button>
            </div>
          )}

          {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
          {added ? (
            <p role="status" className="rounded-lg bg-moss px-4 py-3 text-sm text-paper">
              {copy.added} <Link href={localizePath("/checkout", locale)} className="underline">{copy.checkout}</Link>
            </p>
          ) : null}

          <ul className="grid gap-2 text-sm text-ink/70">
            <li>✓ {copy.payment}</li>
            <li>✓ {copy.dhl}</li>
            <li>✓ {copy.checked}</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
