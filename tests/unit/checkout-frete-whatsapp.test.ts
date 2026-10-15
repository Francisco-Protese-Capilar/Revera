import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(join(process.cwd(), "src/app/checkout/actions.ts"), "utf8");
const shippingFactory = readFileSync(join(process.cwd(), "src/lib/shipping/index.ts"), "utf8");

describe("checkout nacional — falha de frete com atendimento", () => {
  it("devolve link de WhatsApp quando o frete real nao pode ser calculado", () => {
    expect(actions).toContain('import { linkWhatsApp } from "@/lib/config/whatsapp"');
    expect(actions).toContain("function linkAjudaFrete");
    expect(actions).toContain("suporteWhatsAppUrl: linkAjudaFrete");
    // Mensagem em textos-nacional.ts (cinco línguas) desde 15/10/2026.
    expect(actions).toContain("erro: t.freteNaoCalculado");
    const textos = readFileSync(join(process.cwd(), "src/app/checkout/textos-nacional.ts"), "utf8");
    expect(textos).toContain("Seu pedido ");
    expect(textos).toContain("não foi cobrado");
  });

  it("nao documenta mais venda com frete zero em producao", () => {
    expect(shippingFactory).toContain("checkout recusa criar cobrança sem frete");
    expect(shippingFactory).not.toContain("venda acontece com frete 0");
  });
});
