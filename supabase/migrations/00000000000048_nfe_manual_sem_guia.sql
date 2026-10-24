-- 24/10/2026 — pedido com NF-e manual e sem guia não fica mais preso (achado C3 do Codex, 08/10).
--
-- A migration 41 passou a exigir NF-e da Focus para criar guia DHL e para
-- despachar todo pedido internacional. A exceção dela (legacy_dhl_shipments)
-- só cobre quem JÁ tinha guia. E a migration 39 recusa abrir NF-e na Focus
-- quando o pedido já tem qualquer NF-e anexada. Resultado: um pedido com NF-e
-- emitida e anexada à mão, ainda sem guia, não tinha saída. Era o caso do
-- REV-7DA5CEBF (pago em 07/10, NF-e nº 52 anexada em 09/10, sem guia).
--
-- Emitir outra NF-e na Focus duplicaria a nota de uma venda real, então a
-- trava da migration 39 continua como está. A saída é uma LISTA FECHADA,
-- preenchida só aqui, com os pedidos que hoje têm NF-e manual de chave válida
-- e nenhuma NF-e Focus. Para eles, manual_nfe_liberada() aceita a NF-e
-- manual no lugar da Focus nas três travas, e SÓ depois de um admin conferi-la
-- (status 'verified', validated_by) com a MESMA chave registrada aqui.
-- Pedido novo continua obrigado a usar a Focus: ninguém entra na lista pela
-- API, porque a tabela não tem policy de escrita.
--
-- As três funções são alteradas por substituição exata de um trecho do texto
-- em produção; se o trecho não aparecer exatamente uma vez, a migration falha.

create table if not exists manual_nfe_dispatch_orders (
  order_id uuid primary key references orders(id),
  nfe_reference text not null check (nfe_reference ~ '^[0-9]{44}$'),
  motivo text not null,
  created_at timestamptz not null default now()
);
alter table manual_nfe_dispatch_orders enable row level security;
drop policy if exists "admin read manual nfe dispatch" on manual_nfe_dispatch_orders;
create policy "admin read manual nfe dispatch" on manual_nfe_dispatch_orders for select to authenticated
  using (exists(select 1 from admin_users where id = auth.uid()));

insert into manual_nfe_dispatch_orders(order_id, nfe_reference, motivo)
select o.id, d.reference, 'NF-e manual anexada antes da exigência da Focus, sem guia (migration 48)'
  from orders o
  join addresses a on a.id = o.address_id
  join order_export_documents d on d.order_id = o.id and d.kind = 'nfe' and d.source = 'external'
 where a.country <> 'BR'
   and o.payment_status = 'paid' and o.canceled_at is null
   and o.shipping_status not in ('shipped', 'delivered')
   and d.reference ~ '^[0-9]{44}$'
   and not exists (select 1 from order_focus_nfe n where n.order_id = o.id)
   and not exists (select 1 from shipments s where s.order_id = o.id)
on conflict (order_id) do nothing;

create or replace function public.manual_nfe_liberada(p_order_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
      from manual_nfe_dispatch_orders m
      join order_export_documents d
        on d.order_id = m.order_id and d.kind = 'nfe' and d.source = 'external'
       and d.reference = m.nfe_reference
     where m.order_id = p_order_id
       and d.status = 'verified' and d.validated_by is not null and d.validated_at is not null
       and not exists (select 1 from order_focus_nfe n where n.order_id = p_order_id)
  );
$$;
revoke all on function public.manual_nfe_liberada(uuid) from public, anon;

do $mig$
declare
  def text;
  novo text;
  trecho text;
begin
  -- 1) Criar a guia DHL (e avançá-la) sem NF-e Focus, para os pedidos liberados.
  def := pg_get_functiondef('public.guard_focus_dhl_reservation()'::regprocedure);
  trecho := $a$  perform 1 from order_focus_nfe where order_id = new.order_id for update;
$a$;
  if (length(def) - length(replace(def, trecho, ''))) / length(trecho) <> 1 then
    raise exception 'migration 48: trecho de guard_focus_dhl_reservation não encontrado exatamente uma vez';
  end if;
  execute replace(def, trecho, trecho || $b$  if public.manual_nfe_liberada(new.order_id) then return new; end if;
$b$);

  -- 2) Ambiente fiscal: sem NF-e Focus, o pedido liberado não tem ambiente a comparar.
  def := pg_get_functiondef('public.guard_focus_shipping_environment()'::regprocedure);
  trecho := $a$      and (tg_table_name='orders' or s.id=new.id)) then return new; end if;
$a$;
  if (length(def) - length(replace(def, trecho, ''))) / length(trecho) <> 1 then
    raise exception 'migration 48: trecho de guard_focus_shipping_environment não encontrado exatamente uma vez';
  end if;
  execute replace(def, trecho, trecho || $b$  if not found and public.manual_nfe_liberada(pedido_id) then return new; end if;
$b$);

  -- 3) Despacho: aceita a NF-e manual conferida no lugar da Focus.
  def := pg_get_functiondef('public.export_require_documents_for_dispatch()'::regprocedure);
  trecho := $a$  ) then
    raise exception 'Despacho exige NF-e autorizada na Focus com XML e DANFE privados';$a$;
  if (length(def) - length(replace(def, trecho, ''))) / length(trecho) <> 1 then
    raise exception 'migration 48: trecho de export_require_documents_for_dispatch não encontrado exatamente uma vez';
  end if;
  execute replace(def, trecho, $b$  ) and not public.manual_nfe_liberada(new.id) then
    raise exception 'Despacho exige NF-e autorizada na Focus com XML e DANFE privados';$b$);
end $mig$;
