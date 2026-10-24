-- 24/10/2026 — trava de despacho por aviso de estorno.
--
-- Quando o PayPal avisa PAYMENT.CAPTURE.REFUNDED/REVERSED mas a ordem ainda
-- lê "concluída" (chargeback em análise), o pedido continua 'paid'. Antes,
-- o sistema só mandava e-mail à equipe, e as travas de despacho aceitavam
-- 'paid': perdido o e-mail, a mercadoria podia sair depois de um estorno
-- (achado do Codex, 07–08/10/2026).
--
-- Agora o aviso grava dispatch_hold_reason no pedido. Enquanto ele existir,
-- o banco recusa qualquer passo de despacho (emissão de etiqueta, guia e
-- envio). Só um admin limpa a trava, depois de conferir o PayPal
-- (liberarTravaDespachoAction, com registro em audit_logs).
--
-- Aditiva: pedidos sem trava se comportam como antes. 'delivered' não é
-- barrado — a peça já saiu, e travar a entrega não traz nada de volta.

alter table orders
  add column if not exists dispatch_hold_reason text,
  add column if not exists dispatch_hold_at timestamptz;

comment on column orders.dispatch_hold_reason is
  'Motivo que impede o despacho (ex.: paypal_aviso_estorno). Nulo = sem trava. Só admin limpa.';

create or replace function public.guard_dispatch_hold()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.dispatch_hold_reason is not null
     and new.shipping_status is distinct from old.shipping_status
     and new.shipping_status in ('label_processing', 'label_created', 'shipped') then
    raise exception 'Despacho travado (%): confira o pagamento antes de enviar', new.dispatch_hold_reason
      using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists dispatch_hold_guard on orders;
create trigger dispatch_hold_guard
  before update of shipping_status on orders
  for each row execute function public.guard_dispatch_hold();
