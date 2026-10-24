-- 24/10/2026 — reconciliação de guia DHL pelo painel (achado C7 do Codex, 08/10).
--
-- Quando a resposta da DHL se perde, a guia fica 'creation_unknown' e o admin
-- reconcilia pelo painel (reconciliarGuiaDhlAction → register_dhl_awb_atomic),
-- com a consulta e o comprovante do MyDHL. A função já confere, dentro do
-- banco, que quem chama é admin e que o comprovante existe. Mas o gatilho
-- guard_focus_dhl_reservation (migration 41) exigia auth.role() =
-- 'service_role' para a guia com reserva Focus avançar a 'label_created', e
-- a sessão do admin é 'authenticated': a reconciliação era sempre recusada,
-- e a guia real ficava presa.
--
-- Correção: depois de todas as conferências, register_dhl_awb_atomic liga
-- uma marca LOCAL À TRANSAÇÃO com o id do pedido (set_config(..., true)) só
-- em volta do update da guia, e o gatilho aceita o avanço quando ela bate
-- com o pedido da guia. Cliente nenhum consegue ligar essa marca pela API:
-- ela não é um parâmetro de requisição e nenhuma outra função a define.
--
-- As duas funções são alteradas por substituição exata de um trecho do
-- texto em produção (conferido por md5 em 24/10, igual em homologação);
-- se o trecho não for achado exatamente uma vez, a migration falha.
do $mig$
declare
  def text;
  novo text;
begin
  -- 1) Gatilho: aceita service_role OU a marca da reconciliação deste pedido.
  def := pg_get_functiondef('public.guard_focus_dhl_reservation()'::regprocedure);
  novo := replace(def,
    $a$      if coalesce(auth.role(), '') <> 'service_role' then$a$,
    $b$      if coalesce(auth.role(), '') <> 'service_role'
         and coalesce(current_setting('revera.reconciliacao_dhl', true), '') <> old.order_id::text then$b$);
  if novo = def or (length(def) - length(replace(def, $a$<> 'service_role' then$a$, ''))) / length($a$<> 'service_role' then$a$) <> 1 then
    raise exception 'migration 47: trecho do gatilho não encontrado exatamente uma vez';
  end if;
  execute novo;

  -- 2) Reconciliação: marca só em volta do update da guia, depois das conferências.
  def := pg_get_functiondef('public.register_dhl_awb_atomic(uuid,text,text,text,text)'::regprocedure);
  novo := replace(def,
    $a$    update shipments set tracking_code = p_awb, status = 'label_created',$a$,
    $b$    perform set_config('revera.reconciliacao_dhl', p_order_id::text, true);
    update shipments set tracking_code = p_awb, status = 'label_created',$b$);
  if novo = def or (length(def) - length(replace(def, $a$update shipments set tracking_code = p_awb, status = 'label_created',$a$, '')))
       / length($a$update shipments set tracking_code = p_awb, status = 'label_created',$a$) <> 1 then
    raise exception 'migration 47: trecho da reconciliação não encontrado exatamente uma vez';
  end if;
  novo := replace(novo,
    $a$      where id = r.id;$a$,
    $b$      where id = r.id;
    perform set_config('revera.reconciliacao_dhl', '', true);$b$);
  execute novo;
end $mig$;
