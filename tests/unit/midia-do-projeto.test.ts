import { afterEach, describe, expect, it, vi } from "vitest";
import { urlDeMidiaDoProjeto } from "@/lib/conteudo/midia";

const ATUAL = "https://bdqtpleyniwuqrjnhzyy.supabase.co";
const ANTIGO = "https://ngnaemfiytutyplolgxb.supabase.co";
const CAMINHO = "/storage/v1/object/public/site-media/originais/cores/1b.jpg";

describe("urlDeMidiaDoProjeto — foto de banco antigo vira do banco atual", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("troca o host de site-media de outro projeto pelo atual, mantendo o caminho", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ATUAL);
    expect(urlDeMidiaDoProjeto(ANTIGO + CAMINHO)).toBe(ATUAL + CAMINHO);
  });

  it("deixa igual o que já é do projeto atual", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ATUAL);
    expect(urlDeMidiaDoProjeto(ATUAL + CAMINHO)).toBe(ATUAL + CAMINHO);
  });

  it("não mexe em public/, outro bucket, terceiro, http, nulo nem texto comum", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", ATUAL);
    for (const v of [
      "/media/base/base-com-fios.jpg",
      ANTIGO + "/storage/v1/object/public/pedidos-fotos/x.jpg",
      "https://exemplo.com/storage/v1/object/public/site-media/x.jpg",
      "http://ngnaemfiytutyplolgxb.supabase.co" + CAMINHO,
      "Prótese capilar com acabamento natural",
    ]) expect(urlDeMidiaDoProjeto(v)).toBe(v);
    expect(urlDeMidiaDoProjeto(null)).toBeNull();
  });

  it("sem a variável do projeto, não arrisca: devolve igual", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    expect(urlDeMidiaDoProjeto(ANTIGO + CAMINHO)).toBe(ANTIGO + CAMINHO);
  });
});
