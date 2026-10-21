// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { CheckoutInternacionalForm, type ResumoInternacional } from "@/app/checkout/CheckoutInternacionalForm";

const action = vi.hoisted(() => vi.fn());
vi.mock("@/app/checkout/actions-internacional", () => ({ criarPedidoInternacionalAction: action }));
vi.mock("@/lib/tracking/atribuicao", () => ({ lerAtribuicao: () => null }));
vi.mock("@/lib/tracking/browser", () => ({ medirIniciarCheckout: vi.fn() }));
vi.mock("@/components/ui/Toast", () => ({ Toast: ({ message }: { message: string }) => React.createElement("div", { role: "alert" }, message) }));

const resumo: ResumoInternacional = {
  idioma: "en", locale: "en-US", moeda: "USD", gateways: ["stripe"],
  pais: { iso: "US", nome: "United States", ddi: "+1", exigeRegiao: true, exigeCodigoPostal: true, rotuloRegiao: "State", rotuloPostal: "ZIP Code", postalExemplo: "10001" },
  itens: [{ variantId: "test", nome: "Hair system", quantidade: 1, precoUnitarioCents: 13000 }],
  subtotalCents: 13000, avisoImpostosTitulo: "Taxes", avisoImpostosTexto: "Taxes may apply", aceiteTexto: "I agree",
};

vi.stubGlobal("React", React);
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
afterEach(() => { vi.clearAllMocks(); document.body.innerHTML = ""; });

it("libera o formulário após falha da Server Action e permite nova consulta", async () => {
  action.mockRejectedValueOnce(new Error("Server Components render"));
  action.mockResolvedValueOnce({ erro: "Check your details", camposComErro: { name: "Name required" } });
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(React.createElement(CheckoutInternacionalForm, { resumo })); });
  const submit = () => container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  try {
    await act(async () => { submit(); });
    expect(container.textContent).toContain("Shipping quotes are temporarily unavailable");
    expect(container.querySelector("input")!.disabled).toBe(false);
    expect(container.querySelector<HTMLButtonElement>('button[type="submit"]')!.disabled).toBe(false);
    expect(container.textContent).not.toContain("Getting DHL quote…");
    await act(async () => { submit(); });
    expect(action).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("Check your details");
    expect(container.textContent).toContain("Name required");
  } finally {
    await act(async () => { root.unmount(); });
  }
});

it("prioriza e seleciona Stripe mesmo quando PayPal vem primeiro, permitindo escolher a alternativa", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => { root.render(React.createElement(CheckoutInternacionalForm, { resumo: { ...resumo, gateways: ["paypal", "stripe"] } })); });
    const options = container.querySelectorAll<HTMLInputElement>('input[name="paymentPreference"]');
    expect(Array.from(options, option => option.value)).toEqual(["stripe", "paypal"]);
    expect(options[0].checked).toBe(true);
    expect(options[0].closest("label")!.textContent).toContain("Recommended");
    expect(options[1].closest("label")!.textContent).toContain("Another way to pay");
    await act(async () => { options[1].click(); });
    expect(options[1].checked).toBe(true);
    expect(options[0].checked).toBe(false);
    action.mockResolvedValueOnce({ erro: "Check your details" });
    await act(async () => { container.querySelector("form")!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); });
    expect(action.mock.calls[0][0].paymentPreference).toBe("paypal");
  } finally {
    await act(async () => { root.unmount(); });
  }
});

it("mantém PayPal selecionado quando Stripe não está disponível", async () => {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  try {
    await act(async () => { root.render(React.createElement(CheckoutInternacionalForm, { resumo: { ...resumo, gateways: ["paypal"] } })); });
    const options = container.querySelectorAll<HTMLInputElement>('input[name="paymentPreference"]');
    expect(options).toHaveLength(1);
    expect(options[0].value).toBe("paypal");
    expect(options[0].checked).toBe(true);
    expect(container.textContent).not.toContain("Recommended");
  } finally {
    await act(async () => { root.unmount(); });
  }
});
