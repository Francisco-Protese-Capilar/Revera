import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { TEXTOS_PAGAMENTO_INDISPONIVEL } from "@/app/checkout/pagamento/textos-indisponivel";

const fonte = readFileSync(join(process.cwd(), "src/app/checkout/pagamento/page.tsx"), "utf8");
const textos = readFileSync(join(process.cwd(), "src/app/checkout/pagamento/textos-indisponivel.ts"), "utf8");
// Desde 15/10/2026 os textos da tela moram em textos-indisponivel.ts, nas
// cinco línguas; a página só escolhe o motivo e o idioma.
const pt = TEXTOS_PAGAMENTO_INDISPONIVEL.pt;
const ptAscii = (texto: string) => texto.normalize("NFD").replace(/[̀-ͯ]/g, "");

describe("checkout pagamento - recuperacao", () => {
  it("classifica motivos de pagamento indisponivel", () => {
    expect(textos).toContain("type MotivoPagamentoIndisponivel");
    expect(textos).toContain('"erro_tecnico"');
    expect(textos).toContain('"em_preparacao"');
    expect(textos).toContain('"reserva_travada"');
    expect(textos).toContain('"metodo_indisponivel"');
    expect(textos).toContain('"internacional_indisponivel"');
    expect(textos).toContain('"link_bloqueado"');
  });

  it("mantem tentativa segura sem criar segundo link", () => {
    expect(ptAscii(pt.estados.em_preparacao.texto)).toContain("nao abrimos uma segunda cobranca");
    expect(fonte).toContain("<AutoRetryPagamento ativo={aguardando} />");
    expect(pt.tentarNovamente).toBe("Tentar pagamento novamente");
    expect(pt.verPedido).toBe("Ver meu pedido");
    expect(fonte).toContain("<CopiarNumeroPedido numeroPedido={numeroPedido} rotulo={t.copiarNumero} rotuloCopiado={t.numeroCopiado} />");
  });

  it("orienta suporte somente quando precisa de intervencao", () => {
    expect(fonte).toContain('motivo === "reserva_travada"');
    expect(fonte).toContain('motivo === "metodo_indisponivel"');
    expect(fonte).toContain('motivo === "link_bloqueado"');
    expect(fonte).toContain('motivo === "internacional_indisponivel"');
    expect(pt.infoSuporte).toBe("Informação para suporte");
    expect(pt.avisoSuporte).toContain("cobrança pendente");
    expect(fonte).toContain("precisaSuporte ? (");
  });

  it("mantem texto principal humano e diagnostico tecnico separado", () => {
    expect(pt.estados.erro_tecnico.texto).toContain("Seu pedido está salvo");
    expect(pt.avisoContinuar).toContain("sem criar outra compra");
    expect(pt.diagnostico("REV-1", "erro_tecnico", "x")).toBe("Pedido REV-1. Diagnóstico: erro_tecnico. x");
    expect(fonte).toContain("t.diagnostico(numeroPedido, motivo, SUPORTE_POR_MOTIVO[motivo])");
    expect(fonte).not.toContain("Diagnóstico do pedido: {motivo}");
  });

  it("explica as opcoes rapidas esperadas no checkout hospedado", () => {
    expect(pt.infinitePayPix).toContain("Pix aparece como opção rápida");
    expect(pt.infinitePayCartao).toContain("Cartão de crédito fica disponível");
    expect(pt.infinitePayCarteiras).toContain("Apple Pay ou Google Pay aparecem");
    expect(fonte).toContain('checkout === "infinitepay"');
  });

  it("a tela recebe o idioma da jornada, nunca fixa em portugues", () => {
    expect(fonte).toContain("telaDePagamentoIndisponivel(pedido.order_number, accessToken, idiomaPagamento, {");
    expect(fonte).not.toMatch(/telaDePagamentoIndisponivel\(pedido\.order_number, accessToken, \{/);
    expect(fonte).toContain("lang={LANG_HTML[idioma]}");
  });
});
