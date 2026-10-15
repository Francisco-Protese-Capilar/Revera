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
- A vitrine (localizada e em português) precifica pelo mesmo destino do
  checkout (GB → GBP, CA → CAD, AU → AUD, PT → EUR); `?pais=` na URL de
  produto ou catálogo vale como escolha. Destino conhecido mas fechado em
  CHECKOUT_PAISES aparece sem preço e sem "adicionar", com convite para
  escolher o país — nunca a moeda de outro mercado. Quem lê em outra língua
  e compra para o Brasil vê BRL e frete nacional; quem lê em português e
  compra para fora vê a página de produto internacional, e a sacola nacional
  encaminha ao checkout.
- `experience_context.locale` do PayPal recebe `fr-FR`, `de-DE` e as variantes
  regionais válidas (en-GB, en-AU, fr-CA, pt-PT). Stripe já cobria.
- Telas de pagamento indisponível, erros do servidor internacional e a página
  do pedido seguem o idioma da jornada; a preferência manual sobrevive à volta
  do gateway pelo cookie.

## O que não muda

- Preço base nacional, escada 650/620/600, política internacional (BRL × PTAX
  com `variant_prices` como elegibilidade), CHECKOUT_PAISES, provedores.
- Reservas, idempotência e bloqueio de nova cobrança no pagamento.
- A home em português (`/`) não mostra preço por destino; catálogo e produto
  mostram.

## Complementos do mesmo dia

- **Formulário nacional traduzido** (`src/app/checkout/textos-nacional.ts`):
  CEP/UF/CPF, Pix/cartão, resumo e mensagens de erro do servidor nas cinco
  línguas quando o Brasil é lido em outro idioma. O português é o texto de
  sempre, byte a byte; as regras de validação não mudam com a língua.
- **Idioma gravado no pedido** (`orders.locale`, migração
  `00000000000045_order_locale.sql`, aplicada em staging em 15/10/2026 e em
  produção antes do deploy correspondente): páginas do pedido e do pagamento,
  e-mail de confirmação e recuperação internacional preferem o idioma do
  pedido; sem ele, cookie manual e depois o idioma do país. Nulo em pedidos
  antigos.
- **Preview da Vercel**: as variáveis de staging do cofre `revera stg` foram
  instaladas no ambiente Preview do projeto `revera` sem escopo de branch
  (antes só existiam presas a três branches antigos), para o deploy de
  Preview de qualquer PR subir como staging declarado.
- **Checkout hospedado da Stripe** aberto em sandbox nas cinco línguas com a
  chave de teste; PayPal sandbox continua pendente por falta de credencial.
