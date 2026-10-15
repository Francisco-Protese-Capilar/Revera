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

describe("checkout nacional — cotação concorrente e envio duplo (Codex r3, 15/10/2026)", () => {
  it("só a cotação mais recente grava frete, aviso e estado de pendência", () => {
    expect(checkout).toContain("const minhaCotacao = ++cotacaoEmVoo.current");
    expect(checkout).toContain("const souAtual = () => cotacaoEmVoo.current === minhaCotacao");
    expect(checkout).toContain("if (!souAtual()) return;");
    expect(checkout).toContain("if (souAtual()) setCotandoFrete(false);");
  });

  it("limpa o frete do CEP anterior ao iniciar uma cotação nova", () => {
    const inicio = checkout.indexOf("const minhaCotacao = ++cotacaoEmVoo.current");
    const limpa = checkout.indexOf("setFrete(null);", inicio);
    const fetchPos = checkout.indexOf('fetch("/api/frete"', inicio);
    expect(limpa).toBeGreaterThan(inicio);
    expect(limpa).toBeLessThan(fetchPos);
  });

  it("trava síncrona impede duas Server Actions no mesmo envio", () => {
    expect(checkout).toContain("if (enviandoRef.current) return;");
    expect(checkout).toContain("enviandoRef.current = true;");
    expect(checkout.split("enviandoRef.current = false;").length).toBe(5);
    expect(checkout).not.toContain("NEXT_REDIRECT\")");
    expect(checkout).toContain("} catch {\n      // Qualquer exceção");
    // a montagem do payload (atribuição, localStorage) fica DENTRO do try
    const tryPos = checkout.indexOf("resultado = await criarPedidoAction(payload)");
    const payloadPos = checkout.indexOf("const payload: CheckoutInput = {");
    const tryInicio = checkout.lastIndexOf("try {", tryPos);
    expect(payloadPos).toBeGreaterThan(tryInicio);
    expect(payloadPos).toBeLessThan(tryPos);
  });

  it("CEP incompleto invalida a cotação em voo e solta o botão", () => {
    const ramo = checkout.indexOf("if (digitos.length !== 8) {\n      // CEP apagado");
    expect(ramo).toBeGreaterThan(0);
    const trecho = checkout.slice(ramo, ramo + 400);
    expect(trecho).toContain("cotacaoEmVoo.current += 1;");
    expect(trecho).toContain("setCotandoFrete(false);");
  });
});

