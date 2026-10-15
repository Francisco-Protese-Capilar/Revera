import { Price } from "./Price";
import { formatarDinheiroParaComprador } from "@/lib/internacional/moeda";

export interface CheckoutSummaryProps {
  subtotalCents: number;
  discountCents: number;
  // null = frete ainda não cotado (CEP em branco, ou a transportadora não
  // respondeu) — mostra texto, nunca um valor inventado. Zero está proibido
  // aqui de propósito: "R$ 0,00" no lugar de "ainda não calculado" é uma
  // promessa de frete grátis que ninguém fez. 26/08/2026.
  shippingCents: number | null;
  // Onde este resumo aparece, o frete se resolve de um jeito diferente: no
  // checkout basta preencher o CEP; no carrinho ainda não há endereço.
  shippingHint?: string;
  totalCents: number;
  /** Rótulos traduzidos (item 1, 15/10/2026). Sem eles, o português de sempre. */
  rotulos?: { subtotal: string; desconto: string; frete: string; total: string };
  /** Locale de NÚMERO para quem lê em outra língua; o valor continua em BRL. */
  moneyLocale?: string;
}

// Espelha exatamente orders.subtotal_cents / discount_cents /
// shipping_cents / total_cents — só exibe, não soma nada sozinho. A soma é
// responsabilidade do backend (evita a UI "corrigir" um total que veio
// errado do servidor e esconder um bug de verdade).
export function CheckoutSummary({
  subtotalCents,
  discountCents,
  shippingCents,
  totalCents,
  shippingHint = "calculado na próxima etapa",
  rotulos,
  moneyLocale,
}: CheckoutSummaryProps) {
  const r = rotulos ?? { subtotal: "Subtotal", desconto: "Desconto", frete: "Frete", total: "Total" };
  // Em português o <Price> de sempre; em outra língua, o mesmo BRL agrupado
  // no locale de quem lê (1,250.00 em vez de 1.250,00).
  const Valor = ({ cents }: { cents: number }) =>
    moneyLocale && moneyLocale !== "pt-BR"
      ? <>{formatarDinheiroParaComprador(cents, "BRL", moneyLocale)}</>
      : <Price cents={cents} />;
  return (
    <dl className="flex flex-col gap-2 rounded-lg border border-sand p-4">
      <div className="flex justify-between text-ink/80">
        <dt>{r.subtotal}</dt>
        <dd>
          <Valor cents={subtotalCents} />
        </dd>
      </div>
      {discountCents > 0 ? (
        <div className="flex justify-between text-moss">
          <dt>{r.desconto}</dt>
          <dd>−<Valor cents={discountCents} /></dd>
        </div>
      ) : null}
      <div className="flex justify-between text-ink/80">
        <dt>{r.frete}</dt>
        <dd>{shippingCents == null ? <span className="text-ink/60">{shippingHint}</span> : <Valor cents={shippingCents} />}</dd>
      </div>
      {/* aria-live: o total muda quando quantidade/desconto mudam antes do
          envio — quem usa leitor de tela precisa ouvir isso sem navegar até
          aqui de novo. */}
      <div className="flex justify-between border-t border-sand pt-2 text-lg font-semibold text-ink" aria-live="polite">
        <dt>{r.total}</dt>
        <dd>
          <Valor cents={totalCents} />
        </dd>
      </div>
    </dl>
  );
}
