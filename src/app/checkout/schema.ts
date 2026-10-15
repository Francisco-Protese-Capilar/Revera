import { z } from "zod";
import { cpfValido, limparCPF } from "@/lib/format/cpf";
import type { Idioma } from "@/lib/internacional/idioma";
import { textosNacional } from "./textos-nacional";

/**
 * Um texto de rastreamento, ou nada.
 *
 * O teto de 500 caracteres não é estética: sem ele, alguém pode mandar um
 * utm_campaign de dez megabytes e inflar a tabela de pedidos. Cinco centenas
 * cobre com folga qualquer nome de campanha real.
 */
const textoCurto = z.string().max(500).nullable().optional().catch(null);

// Schema único do formulário de checkout — compartilhado entre o client
// (CheckoutForm.tsx, para tipar o payload) e a Server Action
// (actions.ts, para validar de verdade). A validação que importa é sempre
// a do servidor; o client só usa os tipos daqui, nunca decide sozinho se
// um dado é válido.
//
// CPF e CEP: valida o formato "como a pessoa digitou" (com ou sem máscara)
// e SÓ DEPOIS transforma para dígito puro — se transformasse antes,
// `refine` receberia só números e não pegaria erro nenhum de formato
// (não que isso mude o resultado aqui, mas a ordem importa se algum dia a
// regra de formato ficar mais específica).
/**
 * Fábrica por idioma (item 1 das pendências de 15/10/2026): as mensagens de
 * erro voltam na língua em que a tela foi lida. As REGRAS são as mesmas em
 * qualquer idioma — só o texto muda. `checkoutSchema` (português) continua
 * exportado para tipos e para quem já importava.
 */
export function checkoutSchemaDoIdioma(idioma: Idioma) {
  const t = textosNacional(idioma);
  return z.object({
  trackingConsent: z.boolean().optional().default(false),
  /** Idioma da tela; só escolhe a língua das mensagens, nunca o país. */
  idioma: z.enum(["pt", "en", "es", "fr", "de"]).optional(),
  paymentPreference: z.enum(["default", "apple_pay"]).optional().default("default"),
  /**
   * País de entrega. Default 'BR' — e hoje esse é o único valor que o
   * checkout público oferece, porque não há como cobrar cliente
   * estrangeiro (ver paisesDoCheckout() em src/lib/internacional/paises.ts).
   *
   * O campo existe assim mesmo, e não "quando abrir o internacional",
   * porque é ele que carrega o país até o banco. Um pedido gravado sem país
   * viraria adivinhação depois.
   *
   * As validações abaixo (CPF, CEP, UF, bairro) continuam BRASILEIRAS e
   * continuam obrigatórias, exatamente como antes desta mudança: enquanto
   * `country` for 'BR', nada no comportamento nacional muda. O caminho
   * internacional tem validação própria, em src/lib/internacional/endereco.ts,
   * e não passa por este schema.
   */
  country: z
    .string()
    .trim()
    .default("BR")
    .transform((v) => v.toUpperCase())
    .refine((v) => v === "BR", t.soBrasil),
  name: z.string().trim().min(3, t.erroNome),
  email: z
    .string()
    .trim()
    .email(t.erroEmail)
    .transform((v) => v.toLowerCase()),
  phone: z
    .string()
    .trim()
    .refine((v) => {
      const digitos = v.replace(/\D/g, "");
      return digitos.length === 10 || digitos.length === 11;
    }, t.erroTelefone)
    .transform((v) => v.replace(/\D/g, "")),
  cpf: z
    .string()
    .trim()
    .refine((v) => cpfValido(v), t.erroCpf)
    .transform((v) => limparCPF(v)),
  cep: z
    .string()
    .trim()
    .refine((v) => /^\d{5}-?\d{3}$/.test(v), t.erroCep)
    .transform((v) => v.replace(/\D/g, "")),
  street: z.string().trim().min(1, t.erroRua),
  number: z.string().trim().min(1, t.erroNumero),
  complement: z.string().trim().nullable(),
  neighborhood: z.string().trim().min(1, t.erroBairro),
  city: z.string().trim().min(1, t.erroCidade),
  state: z
    .string()
    .trim()
    .refine((v) => /^[A-Za-z]{2}$/.test(v), t.erroUf)
    .transform((v) => v.toUpperCase()),

  /**
   * Atribuição — de onde veio a pessoa. Opcional em tudo: bloqueador de
   * anúncio, navegação privada e visita orgânica deixam estes campos vazios,
   * e nada disso pode impedir alguém de comprar.
   *
   * Aceitar isto do navegador é seguro porque NADA aqui vale dinheiro: são
   * sinais de medição. O pior que alguém consegue mentindo é sujar o próprio
   * relatório. (Compare com `total`, que jamais é aceito do cliente — ver a
   * docstring de actions.ts.)
   *
   * `.catch(null)` em vez de erro de validação: um cookie estranho não pode
   * derrubar um checkout. Perde-se a atribuição daquele pedido; não se perde
   * a venda.
   */
  atribuicao: z
    .object({
      fbp: textoCurto,
      fbc: textoCurto,
      gaClientId: textoCurto,
      fbclid: textoCurto,
      gclid: textoCurto,
      utmSource: textoCurto,
      utmMedium: textoCurto,
      utmCampaign: textoCurto,
      utmContent: textoCurto,
      utmTerm: textoCurto,
      metaCampaignId: textoCurto,
    })
    .nullable()
    .optional()
    .catch(null),
  });
}

const SCHEMAS = new Map<Idioma, ReturnType<typeof checkoutSchemaDoIdioma>>();
export function schemaNacionalDoIdioma(idioma: Idioma) {
  let schema = SCHEMAS.get(idioma);
  if (!schema) {
    schema = checkoutSchemaDoIdioma(idioma);
    SCHEMAS.set(idioma, schema);
  }
  return schema;
}

export const checkoutSchema = schemaNacionalDoIdioma("pt");

// Formato que o CLIENTE envia (antes das transformações de zod) — é o que
// CheckoutForm.tsx monta a partir do estado dos campos.
export type CheckoutInput = z.input<typeof checkoutSchema>;
// Formato já validado/normalizado que a Server Action grava no banco.
export type CheckoutData = z.output<typeof checkoutSchema>;
