import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "@/middleware";
import { LOCALE_HEADER } from "@/lib/i18n/site";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("piloto internacional dos Estados Unidos", () => {
  it("preserva a pagina de produto em ingles quando o clique vem do anuncio", () => {
    const response = middleware(
      new NextRequest("https://www.reveraprotesecapilar.com/en/produtos/micropele-008")
    );

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe("en");
  });

  it("preserva o checkout nos quatro idiomas internacionais", () => {
    const english = middleware(
      new NextRequest("https://www.reveraprotesecapilar.com/en/checkout")
    );
    const spanish = middleware(
      new NextRequest("https://www.reveraprotesecapilar.com/es/checkout")
    );

    expect(english.headers.get("location")).toBeNull();
    expect(english.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe("en");
    expect(spanish.headers.get("location")).toBeNull();
    expect(spanish.headers.get(`x-middleware-request-${LOCALE_HEADER}`)).toBe("es");
  });

  it("redireciona produto pela geolocalizacao para o mercado localizado", () => {
    const response = middleware(
      new NextRequest("https://www.reveraprotesecapilar.com/produtos/micropele-008", {
        headers: { "x-vercel-ip-country": "DE" },
      })
    );

    expect(response.headers.get("location")).toBe("https://www.reveraprotesecapilar.com/de/produtos/micropele-008");
  });

  it("nao expoe o resumo BRL do carrinho ao comprador americano", () => {
    const localizedCart = readFileSync(
      join(process.cwd(), "src/app/[locale]/carrinho/page.tsx"),
      "utf8"
    );
    const provider = readFileSync(
      join(process.cwd(), "src/components/cart/CartProvider.tsx"),
      "utf8"
    );

    expect(localizedCart).toContain('redirect(`/${locale}/checkout`)');
    expect(provider).toContain('if (locale !== "pt") router.push(`/${locale}/checkout`)');
  });

  it("a aba de pais nao troca o idioma: EUA vai para /checkout?pais=US (ou com o prefixo da rota)", () => {
    const checkout = readFileSync(
      join(process.cwd(), "src/app/checkout/renderizar-checkout.tsx"),
      "utf8"
    );

    // Até 15/10/2026 a aba dos EUA apontava para /en/checkout e a rota em
    // inglês impunha o mercado americano; idioma e país agora são
    // independentes (tests/unit/checkout-pais-idioma.test.ts).
    expect(checkout).not.toContain('"/en/checkout"');
    expect(checkout).toContain("hrefDoCheckoutDoPais(iso, localeDaRota)");
  });

  it("a rota localizada le o pais explicito em vez de impor o mercado do idioma", () => {
    const localizedCheckout = readFileSync(
      join(process.cwd(), "src/app/[locale]/checkout/page.tsx"),
      "utf8"
    );

    expect(localizedCheckout).not.toContain("detected === fallback");
    expect(localizedCheckout).toContain("checkoutLocalizado(locale, pais)");
  });
});
