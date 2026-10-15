import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const checkout = readFileSync(join(process.cwd(), "src/app/checkout/CheckoutForm.tsx"), "utf8");
const produtoIntl = readFileSync(
  join(process.cwd(), "src/app/[locale]/produtos/[slug]/ProdutoInternacional.tsx"),
  "utf8"
);

describe("checkout nacional — erro junto do botão (15/10/2026)", () => {
  it("mostra o erro do servidor num bloco com role=alert ao lado do Finalizar pedido", () => {
    const posBloco = checkout.indexOf('ref={erroJuntoDoBotaoRef}');
    const posBotao = checkout.indexOf('type="submit"');
    expect(posBloco).toBeGreaterThan(0);
    expect(posBotao).toBeGreaterThan(posBloco);
    expect(checkout).toContain('role="alert"');
  });

  it("anuncia o erro geral uma vez só (sem Toast duplicado no topo)", () => {
    expect(checkout).not.toContain("<Toast message={erroGeral}");
  });

  it("rola a página até o erro quando ele aparece", () => {
    expect(checkout).toContain("erroJuntoDoBotaoRef.current?.scrollIntoView");
    expect(checkout).toMatch(/useEffect\(\(\) => \{\s*if \(!erroGeral\) return;/);
  });

  it("o link do WhatsApp do frete fica dentro do bloco de erro, não no topo", () => {
    const posBloco = checkout.indexOf('ref={erroJuntoDoBotaoRef}');
    const posWhats = checkout.indexOf("Falar no WhatsApp");
    expect(posWhats).toBeGreaterThan(posBloco);
    expect(checkout.split("Falar no WhatsApp").length).toBe(2);
  });
});

describe("produto internacional — preço antes de escolher a cor (15/10/2026)", () => {
  it("renderiza o preço mesmo sem cor selecionada", () => {
    expect(produtoIntl).toContain("precoExibidoCents !== null");
    expect(produtoIntl).toMatch(/const precoExibidoCents =\s*selected && Number\.isInteger\(selected\.priceCents\)/);
    expect(produtoIntl).not.toMatch(/\{selected \? \(\s*<div className="rounded-xl border border-sand p-4">/);
  });

  it("usa o menor preço com prefixo 'a partir de' só quando as cores têm preços diferentes", () => {
    expect(produtoIntl).toContain("Math.min(...precosValidos)");
    expect(produtoIntl).toContain("Number.isInteger(cents) && cents > 0");
    expect(produtoIntl).toContain("!selected && !precosIguais");
  });

  it("tem o prefixo traduzido nas quatro línguas", () => {
    for (const texto of ['priceFrom: "From"', 'priceFrom: "Desde"', 'priceFrom: "À partir de"', 'priceFrom: "Ab"']) {
      expect(produtoIntl).toContain(texto);
    }
  });

  it("o preço aparece antes da grade de cores", () => {
    expect(produtoIntl.indexOf('data-testid="preco-internacional"')).toBeLessThan(produtoIntl.indexOf("{copy.choose}"));
  });
});
