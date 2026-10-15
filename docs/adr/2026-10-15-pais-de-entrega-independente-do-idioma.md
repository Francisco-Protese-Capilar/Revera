# ADR — país de entrega e idioma são duas informações

**Status:** aceita e implementada
**Data:** 2026-10-15
**Origem:** auditoria do checkout de 15/10/2026 (`docs/auditoria/2026-10-15-checkout-para-claude.md`), achados A1 a A4

## Contexto

A jornada localizada do piloto dos EUA (ADR de 06/10/2026) tratava o prefixo de
idioma como mercado: `/en/checkout` impunha os Estados Unidos, `/en/produtos`
mostrava dólar, e o seletor de idioma montava o link só com o pathname. Em
produção, abrir `/checkout?pais=GB`, clicar em EN e cair em `/en/checkout`
trocava o destino para Estados Unidos e a moeda para USD. Reino Unido, Canadá e
Austrália, embora oferecidos no seletor, não tinham idioma automático e
perdiam a própria moeda na vitrine. PayPal recebia inglês para francês e
alemão, e a tela de falha de pagamento era fixa em português.

## Decisão

Separar três coisas, cada uma com a própria fonte:

1. **País de entrega** decide mercado, moeda, endereço, frete e imposto.
   Precedência: `?pais=` válido → escolha já feita na jornada (cookie
   `revera_pais_entrega`, um dia, gravado pelo middleware só em carregamento
   de página com país explícito) → país detectado na borda, quando a tabela o
   conhece (país fechado recebe indisponibilidade, nunca vira Brasil/EUA em
   silêncio) → mercado padrão do idioma da rota (`/de/checkout` sem nada acima
   cai na Alemanha) → Brasil.
2. **Idioma da interface** decide textos e o idioma pedido ao gateway.
   Precedência: prefixo da rota → escolha manual gravada pelo seletor → idioma
   padrão do destino. Idioma não autoriza mercado e não muda preço.
3. **Formato regional** (separadores, datas) vem da tabela do país de entrega,
   como já era.

O código vive em `src/lib/internacional/destino.ts` (puro, usado pelo
middleware, pelas páginas e pelos testes) e `destino-server.ts` (vitrine). O
middleware calcula o mesmo idioma que a página para o `<html lang>` concordar
com o `<main lang>`.

Consequências visíveis:

- O seletor de idioma carrega `?pais=` (e só ele). As abas de país mantêm o
  prefixo de idioma da rota. A aba dos EUA não leva mais a `/en/checkout`.
- `localeFromCountry` cobre os nove destinos do seletor (BR, US, ES, FR, DE,
  PT, GB, CA, AU) e continua recusando os demais; um teste prende o mapa à
  tabela de países.
- A vitrine localizada precifica pelo destino atendido (GB → GBP, CA → CAD,
  AU → AUD); sem destino atendido, o mercado padrão do idioma continua. Quem
  lê em outra língua e compra para o Brasil vê BRL e frete nacional.
- `experience_context.locale` do PayPal recebe `fr-FR`, `de-DE` e as variantes
  regionais válidas (en-GB, en-AU, fr-CA, pt-PT). Stripe já cobria.
- Telas de pagamento indisponível, erros do servidor internacional e a página
  do pedido seguem o idioma da jornada; a preferência manual sobrevive à volta
  do gateway pelo cookie.

## O que não muda

- Preço base nacional, escada 650/620/600, política internacional (BRL × PTAX
  com `variant_prices` como elegibilidade), CHECKOUT_PAISES, provedores.
- Reservas, idempotência e bloqueio de nova cobrança no pagamento.
- A vitrine SEM prefixo (`/`, `/produtos`) continua nacional em BRL, inclusive
  para visitante de Portugal: mudar isso é decisão comercial pendente.
- O formulário nacional (CEP/UF/CPF) continua em português; só a casca da
  página de checkout é traduzida quando o Brasil é lido em outra língua.
- E-mails e notificações continuam na língua do país de entrega: a preferência
  manual não é persistida no pedido (sem migração nesta correção).
