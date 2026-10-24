/**
 * Migration 47 (24/10/2026): reconciliação de guia DHL pelo painel.
 *
 * O comportamento foi provado em Postgres de verdade (homologação, bloco
 * desfeito): sem a marca, o avanço da guia com reserva Focus é recusado; com
 * a marca de OUTRO pedido, também; com a marca do próprio pedido, liberado.
 * Este teste guarda as garantias do texto da migration.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  join(process.cwd(), "supabase/migrations/00000000000047_dhl_reconciliacao_admin.sql"),
  "utf8"
);

describe("migration 47 — reconciliação DHL pelo admin", () => {
  it("o gatilho só aceita a marca quando ela é o id do pedido da guia", () => {
    expect(sql).toContain("current_setting('revera.reconciliacao_dhl', true), '') <> old.order_id::text");
    expect(sql).toContain("<> 'service_role'");
  });

  it("a reconciliação liga a marca local à transação e a desliga logo depois do update", () => {
    expect(sql).toContain("perform set_config('revera.reconciliacao_dhl', p_order_id::text, true);");
    expect(sql).toContain("perform set_config('revera.reconciliacao_dhl', '', true);");
    expect(sql).not.toMatch(/set_config\('revera\.reconciliacao_dhl',[^)]*false\)/);
  });

  it("falha se o trecho a substituir não estiver exatamente uma vez", () => {
    expect(sql.match(/raise exception 'migration 47:/g)?.length).toBe(2);
  });
});
