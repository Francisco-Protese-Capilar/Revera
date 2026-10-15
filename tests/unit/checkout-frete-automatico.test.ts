import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const fonte = readFileSync(
  join(process.cwd(), "src/app/checkout/CheckoutForm.tsx"),
  "utf8"
);

describe("checkout nacional — frete automatico", () => {
  it("cota frete automaticamente quando o CEP fica completo", () => {
    expect(fonte).toContain("useEffect(() =>");
    expect(fonte).toContain('campos.cep.replace(/\\D/g, "")');
    expect(fonte).toContain("digitos.length !== 8");
    expect(fonte).toContain("void cotarFrete(campos.cep)");
  });

  it("nao depende de blur no campo de CEP para calcular frete", () => {
    expect(fonte).not.toContain("onBlur={(e) =>");
    // Rótulo vive em textos-nacional.ts desde 15/10/2026 (cinco línguas).
    expect(fonte).toContain("{cotandoFrete ? t.calculando : t.calcularFrete}");
  });

  it("evita cotacao repetida e libera nova tentativa quando falha", () => {
    expect(fonte).toContain("ultimoCepCotado");
    expect(fonte).toContain("const chaveCotacao");
    expect(fonte).toContain('ultimoCepCotado.current = ""');
  });

  it("mostra WhatsApp quando o frete real falha no servidor", () => {
    expect(fonte).toContain("suporteFreteHref");
    expect(fonte).toContain("resultado.suporteWhatsAppUrl");
    expect(fonte).toContain("{t.falarWhatsApp}");
  });
});
