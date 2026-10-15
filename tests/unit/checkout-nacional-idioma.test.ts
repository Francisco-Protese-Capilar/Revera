/**
 * Pendências 1 e 2 da auditoria de 15/10/2026:
 *  - formulário NACIONAL (CEP/UF/CPF) traduzido, com o português intocado;
 *  - idioma da jornada gravado no pedido e usado por páginas e e-mails.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { TEXTOS_NACIONAL } from "@/app/checkout/textos-nacional";
import { checkoutSchema, schemaNacionalDoIdioma } from "@/app/checkout/schema";
import { montarPreviasRecuperacaoInternacional } from "@/lib/notificacoes/recuperacao-internacional";

const idiomas = ["pt", "en", "es", "fr", "de"] as const;

describe("item 1 — textos do formulário nacional", () => {
  it("as cinco línguas têm as mesmas chaves e nenhuma repete o português", () => {
    const chaves = Object.keys(TEXTOS_NACIONAL.pt).sort();
    for (const idioma of ["en", "es", "fr", "de"] as const) {
      expect(Object.keys(TEXTOS_NACIONAL[idioma]).sort()).toEqual(chaves);
      for (const chave of chaves) {
        const k = chave as keyof typeof TEXTOS_NACIONAL.pt;
        const a = TEXTOS_NACIONAL[idioma][k];
        const b = TEXTOS_NACIONAL.pt[k];
        const va = typeof a === "function" ? a(3) : a;
        const vb = typeof b === "function" ? b(3) : b;
        // Nomes próprios do mercado (CEP, CPF, UF, Pix, Subtotal, Total) podem coincidir.
        // Espanhol e português coincidem de verdade em algumas palavras.
        if (["cep", "cpf", "uf", "opcional", "resumoSubtotal", "resumoTotal", "email", "erroEmail", "calculando", "freteCalculando", "complemento", "numero", "enviando", "finalizar"].includes(chave)) continue;
        expect(va, `${idioma}.${chave}`).not.toBe(vb);
        expect(String(va).length).toBeGreaterThan(2);
      }
    }
  });

  it("o português continua o texto de sempre, byte a byte, nos pontos que o teste antigo prendia", () => {
    const pt = TEXTOS_NACIONAL.pt;
    expect(pt.finalizar).toBe("Finalizar pedido");
    expect(pt.calcularFrete).toBe("Calcular frete");
    expect(pt.falarWhatsApp).toBe("Falar no WhatsApp");
    expect(pt.sacolaVazia).toBe("Sua sacola está vazia — volte e adicione algo antes de finalizar.");
    expect(pt.erroCpf).toBe("CPF inválido — confira os números digitados.");
    expect(pt.prazo(1)).toBe(" — chega em cerca de 1 dia útil após a postagem.");
    expect(pt.prazo(3)).toBe(" — chega em cerca de 3 dias úteis após a postagem.");
  });

  it("o schema nacional valida as MESMAS regras em qualquer idioma e só muda a mensagem", () => {
    const entrada = { name: "Al", email: "x", phone: "1", cpf: "000", cep: "1", street: "", number: "", neighborhood: "", city: "", state: "S", country: "US" };
    const pt = checkoutSchema.safeParse(entrada);
    const fr = schemaNacionalDoIdioma("fr").safeParse({ ...entrada, idioma: "fr" });
    expect(pt.success).toBe(false);
    expect(fr.success).toBe(false);
    if (pt.success || fr.success) return;
    expect(fr.error.issues.map((i) => i.path.join("."))).toEqual(pt.error.issues.map((i) => i.path.join(".")));
    const msgFr = Object.fromEntries(fr.error.issues.map((i) => [i.path[0], i.message]));
    expect(msgFr.cpf).toBe(TEXTOS_NACIONAL.fr.erroCpf);
    expect(msgFr.country).toBe(TEXTOS_NACIONAL.fr.soBrasil);
    expect(msgFr.cpf).not.toBe(TEXTOS_NACIONAL.pt.erroCpf);
  });

  it("o país de entrega continua sendo só o Brasil, em qualquer idioma", () => {
    for (const idioma of idiomas) {
      const r = schemaNacionalDoIdioma(idioma).safeParse({ name: "Ana Maria", email: "a@b.co", phone: "11999998888", cpf: "529.982.247-25", cep: "01310-100", street: "Av", number: "1", neighborhood: "Centro", city: "SP", state: "sp", country: "GB", idioma });
      expect(r.success, idioma).toBe(false);
    }
  });

  it("o formulário e o resumo usam o dicionário, sem texto fixo em português nos rótulos", () => {
    const form = readFileSync(join(process.cwd(), "src/app/checkout/CheckoutForm.tsx"), "utf8");
    expect(form).toContain("const t = textosNacional(idioma);");
    expect(form).toContain("idioma,\n      };");
    expect(form).toContain(": t.finalizar}");
    for (const fixo of ['label="Nome completo"', 'label="CEP"', ': "Finalizar pedido"', '"Calcular frete"', 'Seus dados</h2>']) {
      expect(form, fixo).not.toContain(fixo);
    }
    const resumo = readFileSync(join(process.cwd(), "src/components/ui/CheckoutSummary.tsx"), "utf8");
    expect(resumo).toContain("rotulos");
    expect(resumo).toContain('const r = rotulos ?? { subtotal: "Subtotal", desconto: "Desconto", frete: "Frete", total: "Total" };');
  });
});

describe("item 2 — idioma gravado no pedido", () => {
  it("os dois caminhos de criação gravam orders.locale a partir do idioma da tela", () => {
    const nacional = readFileSync(join(process.cwd(), "src/app/checkout/actions.ts"), "utf8");
    const intl = readFileSync(join(process.cwd(), "src/app/checkout/actions-internacional.ts"), "utf8");
    expect(nacional).toContain("locale: idioma,");
    expect(intl).toContain("locale: idioma,");
    const migracao = readFileSync(join(process.cwd(), "supabase/migrations/00000000000045_order_locale.sql"), "utf8");
    expect(migracao).toContain("add column if not exists locale text");
    expect(migracao).toContain("in ('pt', 'en', 'es', 'fr', 'de')");
  });

  it("páginas do pedido e do pagamento preferem o idioma gravado ao cookie", () => {
    const pedido = readFileSync(join(process.cwd(), "src/app/pedido/[token]/page.tsx"), "utf8");
    const pagamento = readFileSync(join(process.cwd(), "src/app/checkout/pagamento/page.tsx"), "utf8");
    expect(pedido).toContain("normalizeSiteLocale(pedido.locale as string | null) ??");
    expect(pedido).toContain(", locale\"");
    expect(pagamento).toContain("normalizeSiteLocale(pedido.locale as string | null) ??");
    expect(pagamento).toContain("shipping_quote_id, locale\"");
  });

  it("e-mail de confirmação usa o idioma do pedido e cai no país quando não há", async () => {
    vi.doMock("@/lib/notificacoes/email-operacional", () => ({ enviarEmail: vi.fn(), remetente: () => "x@y" }));
    const { montarConfirmacao } = await import("@/lib/notificacoes/confirmacao-cliente");
    const base = {
      orderNumber: "REV-T1", accessToken: "tok", currency: "EUR", subtotalCents: 100, discountCents: 0, shippingCents: 10, totalCents: 110,
      nome: "Ivan Pineda", itens: [], endereco: [], base: "https://loja.test",
    };
    expect(montarConfirmacao({ ...base, pais: "DE", idioma: "fr" }).idioma).toBe("fr");
    expect(montarConfirmacao({ ...base, pais: "DE", idioma: null }).idioma).toBe("de");
    expect(montarConfirmacao({ ...base, pais: "DE" }).idioma).toBe("de");
  });

  it("recuperação internacional fala a língua gravada no pedido", () => {
    const previas = montarPreviasRecuperacaoInternacional([
      { id: "1", orderNumber: "REV-1", createdAt: "2026-10-15T00:00:00Z", currency: "EUR", totalCents: 100, paymentStatus: "pending", country: "DE", locale: "fr", customer: { name: "Ivan", email: "i@x.co", phone: null } },
      { id: "2", orderNumber: "REV-2", createdAt: "2026-10-15T00:00:00Z", currency: "GBP", totalCents: 100, paymentStatus: "pending", country: "GB", locale: null, customer: { name: "Ann", email: "a@x.co", phone: null } },
    ]);
    expect(previas.map((p) => p.idioma)).toEqual(["fr", "en"]);
    expect(previas[0]!.mensagem).toContain("Bonjour");
  });
});
