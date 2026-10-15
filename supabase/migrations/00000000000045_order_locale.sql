-- 15/10/2026 — idioma da jornada gravado no pedido.
--
-- A auditoria do checkout separou país de entrega (mercado, moeda) de idioma
-- da interface. A preferência manual de idioma vivia só no cookie: a página
-- do pedido e o pagamento a liam, mas e-mails e notificações continuavam na
-- língua do país. Com a coluna, o idioma em que a pessoa comprou acompanha o
-- pedido para sempre — inclusive quando o link é aberto sem cookie.
--
-- Nula para pedidos antigos: quem lê cai no idioma do país de entrega, como
-- antes. Nunca muda moeda, valor nem país.
alter table orders
  add column if not exists locale text
  check (locale is null or locale in ('pt', 'en', 'es', 'fr', 'de'));

comment on column orders.locale is
  'Idioma da interface em que o pedido foi criado (pt/en/es/fr/de). Nulo = idioma do país de entrega.';
