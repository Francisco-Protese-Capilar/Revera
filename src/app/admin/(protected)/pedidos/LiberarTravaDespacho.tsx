"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Toast } from "@/components/ui/Toast";
import { liberarTravaDespachoAction } from "./actions";

/**
 * Aviso e botão da trava de despacho por aviso de estorno (24/10/2026).
 * Só aparece quando orders.dispatch_hold_reason está preenchido.
 */
export function LiberarTravaDespacho({ orderId, travadoEm }: { orderId: string; travadoEm: string | null }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function liberar() {
    const confirmou = window.confirm(
      "Antes de liberar: você conferiu no PayPal que NÃO há estorno nem disputa aberta contra este pagamento?\n\nSe houver, NÃO libere: o pedido pode ser despachado sem o dinheiro."
    );
    if (!confirmou) return;
    setErro(null);
    setOcupado(true);
    const resultado = await liberarTravaDespachoAction({ orderId });
    setOcupado(false);
    if ("error" in resultado) {
      setErro(resultado.error);
      return;
    }
    router.refresh();
  }

  return (
    <div role="alert" className="flex flex-col gap-2 rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-900">
      {erro ? <Toast message={erro} variant="error" onClose={() => setErro(null)} /> : null}
      <p className="font-semibold">Despacho travado: o PayPal avisou estorno ou disputa.</p>
      <p>
        A cobrança ainda aparece como concluída no PayPal. Confira a transação e as disputas antes de enviar.
        {travadoEm ? ` Travado em ${new Date(travadoEm).toLocaleString("pt-BR")}.` : ""}
      </p>
      <div>
        <Button type="button" variant="ghost" size="sm" onClick={liberar} disabled={ocupado}>
          {ocupado ? "Liberando…" : "Conferi no PayPal: liberar despacho"}
        </Button>
      </div>
    </div>
  );
}
