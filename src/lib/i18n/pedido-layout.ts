import "server-only";
import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import { idiomaDoPais } from "@/lib/internacional/paises";
import { normalizeSiteLocale, type SiteLocale } from "./site";

/** Consulta somente o idioma, sem confirmar pagamento nem alterar o pedido. */
export const idiomaDoLayoutDoPedido = cache(async (token: string | null, fallback: SiteLocale): Promise<SiteLocale> => {
  if (!token || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return fallback;
  const db = createAdminClient();
  const { data: pedido } = await db.from("orders").select("locale, address_id").eq("access_token", token).maybeSingle();
  if (!pedido) return fallback;
  const locale = normalizeSiteLocale(pedido.locale);
  if (locale) return locale;
  const { data: endereco } = pedido.address_id
    ? await db.from("addresses").select("country").eq("id", pedido.address_id).maybeSingle()
    : { data: null };
  return idiomaDoPais(endereco?.country ?? "BR");
});
