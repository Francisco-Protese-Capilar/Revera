/**
 * Migration 48 (24/10/2026): pedido com NF-e manual e sem guia não fica preso.
 * O comportamento foi provado em Postgres (homologação, bloco desfeito); este
 * teste guarda as garantias do texto.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(join(process.cwd(), "supabase/migrations/00000000000048_nfe_manual_sem_guia.sql"), "utf8");

describe("migration 48 — NF-e manual sem guia", () => {
  it("a lista é fechada: só a migration preenche, e a tabela não tem policy de escrita", () => {
    expect(sql).toContain("create table if not exists manual_nfe_dispatch_orders");
    expect(sql).not.toMatch(/on manual_nfe_dispatch_orders for (insert|update|delete|all)/);
    expect(sql).toContain("not exists (select 1 from shipments s where s.order_id = o.id)");
    expect(sql).toContain("not exists (select 1 from order_focus_nfe n where n.order_id = o.id)");
  });

  it("libera só com a NF-e da mesma chave conferida por admin e sem NF-e Focus", () => {
    expect(sql).toContain("d.reference = m.nfe_reference");
    expect(sql).toContain("d.status = 'verified' and d.validated_by is not null and d.validated_at is not null");
    expect(sql).toMatch(/not exists \(select 1 from order_focus_nfe n where n\.order_id = p_order_id\)/);
  });

  it("não mexe na trava que impede abrir NF-e Focus em pedido que já tem NF-e", () => {
    expect(sql).not.toContain("validate_focus_nfe_reservation");
  });

  it("cada troca de trecho falha se não achar o trecho exatamente uma vez", () => {
    expect(sql.match(/raise exception 'migration 48:/g)?.length).toBe(3);
  });
});
