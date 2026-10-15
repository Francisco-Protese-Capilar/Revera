import type { Idioma } from "@/lib/internacional/idioma";

/**
 * Textos da tela "pagamento indisponível" nas cinco línguas (A4 da
 * auditoria de 15/10/2026: a tela era fixa em português, inclusive para o
 * comprador internacional que acabara de preencher tudo em inglês).
 *
 * Módulo puro, sem React nem Next, para o teste conferir as 6 × 5
 * combinações sem renderizar a página. O campo `suporte` é diagnóstico
 * para a equipe e fica em português de propósito, em todas as línguas.
 */
export type MotivoPagamentoIndisponivel =
  | "erro_tecnico"
  | "em_preparacao"
  | "reserva_travada"
  | "metodo_indisponivel"
  | "internacional_indisponivel"
  | "link_bloqueado";

export const MOTIVOS_PAGAMENTO_INDISPONIVEL: readonly MotivoPagamentoIndisponivel[] = [
  "erro_tecnico",
  "em_preparacao",
  "reserva_travada",
  "metodo_indisponivel",
  "internacional_indisponivel",
  "link_bloqueado",
];

export interface EstadoIndisponivel {
  titulo: string;
  texto: string;
  detalhe: string;
}

export interface TextosPagamentoIndisponivel {
  pedido: (numero: string) => string;
  estados: Record<MotivoPagamentoIndisponivel, EstadoIndisponivel>;
  quandoAbrir: string;
  infinitePayPix: string;
  infinitePayCartao: string;
  infinitePayCarteiras: string;
  tentarNovamente: string;
  verPedido: string;
  copiarNumero: string;
  numeroCopiado: string;
  avisoSuporte: string;
  avisoContinuar: string;
  infoSuporte: string;
  diagnostico: (numero: string, motivo: string, suporte: string) => string;
}

/** Diagnóstico para a equipe — sempre em português, em qualquer idioma. */
export const SUPORTE_POR_MOTIVO: Record<MotivoPagamentoIndisponivel, string> = {
  erro_tecnico: "Falha técnica antes de abrir o checkout.",
  em_preparacao: "Existe reserva pendente sem URL pronta ou uma criação ainda em andamento.",
  reserva_travada: "Reserva pendente sem URL passou do tempo de espera.",
  metodo_indisponivel: "Provider de pagamento indisponível ou configuração ausente.",
  internacional_indisponivel: "Pedido internacional sem condição pagável no momento.",
  link_bloqueado: "URL retornada pelo gateway não passou no allowlist.",
};

const PT: TextosPagamentoIndisponivel = {
  pedido: (n) => `Pedido ${n}`,
  estados: {
    erro_tecnico: {
      titulo: "Não conseguimos abrir o pagamento",
      texto: "Seu pedido está salvo e nada foi cobrado. Tente abrir o pagamento novamente em instantes.",
      detalhe: "Se continuar acontecendo, veja seu pedido para acompanhar a compra ou falar com a equipe sem criar outro pedido.",
    },
    em_preparacao: {
      titulo: "Estamos preparando seu pagamento",
      texto: "Seu pedido está salvo. Aguarde um instante; para sua segurança, não abrimos uma segunda cobrança.",
      detalhe: "A página tenta novamente sozinha por alguns segundos. Você também pode tentar de novo manualmente.",
    },
    reserva_travada: {
      titulo: "Pagamento em análise pela equipe",
      texto: "Seu pedido está salvo, mas esta tentativa demorou mais que o esperado. Não abrimos outra cobrança automaticamente para evitar pagamento duplicado.",
      detalhe: "Copie o número do pedido ou veja seu pedido para falar com a equipe. A equipe confere a cobrança pendente antes de liberar nova tentativa.",
    },
    metodo_indisponivel: {
      titulo: "Método de pagamento indisponível",
      texto: "Seu pedido está salvo e nada foi cobrado. O método de pagamento não está disponível neste momento.",
      detalhe: "Tente novamente em instantes. Se continuar, veja seu pedido para falar com a equipe.",
    },
    internacional_indisponivel: {
      titulo: "Pagamento internacional indisponível",
      texto: "Seu pedido está salvo, mas ainda não conseguimos abrir pagamento para este destino com segurança.",
      detalhe: "Preço, frete e país precisam estar ativos antes de cobrar um pedido internacional. Veja seu pedido para falar com a equipe.",
    },
    link_bloqueado: {
      titulo: "Link de pagamento bloqueado",
      texto: "Seu pedido está salvo e nada foi cobrado. O link retornado pelo pagamento não passou pela validação de segurança.",
      detalhe: "Tente novamente em instantes. Se continuar, veja seu pedido para falar com a equipe.",
    },
  },
  quandoAbrir: "Quando o checkout abrir",
  infinitePayPix: "Pix aparece como opção rápida no checkout da InfinitePay.",
  infinitePayCartao: "Cartão de crédito fica disponível para finalizar na hora.",
  infinitePayCarteiras: "Apple Pay ou Google Pay aparecem quando o seu aparelho e navegador permitem.",
  tentarNovamente: "Tentar pagamento novamente",
  verPedido: "Ver meu pedido",
  copiarNumero: "Copiar número do pedido",
  numeroCopiado: "Número copiado",
  avisoSuporte: "Se precisar falar com a equipe, envie o número do pedido. Antes de liberar uma nova tentativa, a equipe confere se já existe cobrança pendente.",
  avisoContinuar: "Se continuar, abra “Ver meu pedido” para acompanhar a recuperação sem criar outra compra.",
  infoSuporte: "Informação para suporte",
  diagnostico: (n, motivo, suporte) => `Pedido ${n}. Diagnóstico: ${motivo}. ${suporte}`,
};

const EN: TextosPagamentoIndisponivel = {
  pedido: (n) => `Order ${n}`,
  estados: {
    erro_tecnico: {
      titulo: "We could not open the payment page",
      texto: "Your order is saved and nothing was charged. Please try opening the payment again in a moment.",
      detalhe: "If it keeps happening, open your order to follow the purchase or contact the team without creating another order.",
    },
    em_preparacao: {
      titulo: "We are preparing your payment",
      texto: "Your order is saved. Please wait a moment; for your safety, we do not open a second charge.",
      detalhe: "This page retries by itself for a few seconds. You can also try again manually.",
    },
    reserva_travada: {
      titulo: "Payment under review by our team",
      texto: "Your order is saved, but this attempt took longer than expected. We did not open another charge automatically, to avoid a duplicate payment.",
      detalhe: "Copy the order number or open your order to contact the team. The team checks the pending charge before releasing a new attempt.",
    },
    metodo_indisponivel: {
      titulo: "Payment method unavailable",
      texto: "Your order is saved and nothing was charged. The payment method is not available right now.",
      detalhe: "Please try again in a moment. If it continues, open your order to contact the team.",
    },
    internacional_indisponivel: {
      titulo: "International payment unavailable",
      texto: "Your order is saved, but we cannot safely open a payment for this destination yet.",
      detalhe: "Price, shipping and country must be active before an international order can be charged. Open your order to contact the team.",
    },
    link_bloqueado: {
      titulo: "Payment link blocked",
      texto: "Your order is saved and nothing was charged. The link returned by the payment provider did not pass our security validation.",
      detalhe: "Please try again in a moment. If it continues, open your order to contact the team.",
    },
  },
  quandoAbrir: "When the checkout opens",
  infinitePayPix: "Pix appears as a quick option in the InfinitePay checkout.",
  infinitePayCartao: "Credit card is available to finish right away.",
  infinitePayCarteiras: "Apple Pay or Google Pay appear when your device and browser allow it.",
  tentarNovamente: "Try the payment again",
  verPedido: "View my order",
  copiarNumero: "Copy order number",
  numeroCopiado: "Number copied",
  avisoSuporte: "If you need to contact the team, send the order number. Before releasing a new attempt, the team checks whether a pending charge already exists.",
  avisoContinuar: "If it continues, open “View my order” to follow the recovery without creating another purchase.",
  infoSuporte: "Information for support",
  diagnostico: (n, motivo, suporte) => `Order ${n}. Diagnosis: ${motivo}. ${suporte}`,
};

const ES: TextosPagamentoIndisponivel = {
  pedido: (n) => `Pedido ${n}`,
  estados: {
    erro_tecnico: {
      titulo: "No pudimos abrir el pago",
      texto: "Tu pedido está guardado y no se cobró nada. Intenta abrir el pago de nuevo en unos instantes.",
      detalhe: "Si sigue ocurriendo, abre tu pedido para seguir la compra o hablar con el equipo sin crear otro pedido.",
    },
    em_preparacao: {
      titulo: "Estamos preparando tu pago",
      texto: "Tu pedido está guardado. Espera un momento; por tu seguridad, no abrimos un segundo cobro.",
      detalhe: "La página vuelve a intentarlo sola durante unos segundos. También puedes intentarlo manualmente.",
    },
    reserva_travada: {
      titulo: "Pago en revisión por el equipo",
      texto: "Tu pedido está guardado, pero este intento tardó más de lo esperado. No abrimos otro cobro automáticamente para evitar un pago duplicado.",
      detalhe: "Copia el número del pedido o abre tu pedido para hablar con el equipo. El equipo revisa el cobro pendiente antes de liberar un nuevo intento.",
    },
    metodo_indisponivel: {
      titulo: "Método de pago no disponible",
      texto: "Tu pedido está guardado y no se cobró nada. El método de pago no está disponible en este momento.",
      detalhe: "Inténtalo de nuevo en unos instantes. Si continúa, abre tu pedido para hablar con el equipo.",
    },
    internacional_indisponivel: {
      titulo: "Pago internacional no disponible",
      texto: "Tu pedido está guardado, pero todavía no podemos abrir el pago para este destino con seguridad.",
      detalhe: "Precio, envío y país deben estar activos antes de cobrar un pedido internacional. Abre tu pedido para hablar con el equipo.",
    },
    link_bloqueado: {
      titulo: "Enlace de pago bloqueado",
      texto: "Tu pedido está guardado y no se cobró nada. El enlace devuelto por el pago no pasó la validación de seguridad.",
      detalhe: "Inténtalo de nuevo en unos instantes. Si continúa, abre tu pedido para hablar con el equipo.",
    },
  },
  quandoAbrir: "Cuando se abra el checkout",
  infinitePayPix: "Pix aparece como opción rápida en el checkout de InfinitePay.",
  infinitePayCartao: "La tarjeta de crédito está disponible para finalizar al momento.",
  infinitePayCarteiras: "Apple Pay o Google Pay aparecen cuando tu dispositivo y navegador lo permiten.",
  tentarNovamente: "Intentar el pago de nuevo",
  verPedido: "Ver mi pedido",
  copiarNumero: "Copiar número del pedido",
  numeroCopiado: "Número copiado",
  avisoSuporte: "Si necesitas hablar con el equipo, envía el número del pedido. Antes de liberar un nuevo intento, el equipo revisa si ya existe un cobro pendiente.",
  avisoContinuar: "Si continúa, abre “Ver mi pedido” para seguir la recuperación sin crear otra compra.",
  infoSuporte: "Información para soporte",
  diagnostico: (n, motivo, suporte) => `Pedido ${n}. Diagnóstico: ${motivo}. ${suporte}`,
};

const FR: TextosPagamentoIndisponivel = {
  pedido: (n) => `Commande ${n}`,
  estados: {
    erro_tecnico: {
      titulo: "Impossible d’ouvrir le paiement",
      texto: "Votre commande est enregistrée et rien n’a été débité. Réessayez d’ouvrir le paiement dans un instant.",
      detalhe: "Si le problème persiste, ouvrez votre commande pour suivre l’achat ou contacter l’équipe sans créer une autre commande.",
    },
    em_preparacao: {
      titulo: "Nous préparons votre paiement",
      texto: "Votre commande est enregistrée. Patientez un instant ; pour votre sécurité, nous n’ouvrons pas un second prélèvement.",
      detalhe: "La page réessaie automatiquement pendant quelques secondes. Vous pouvez aussi réessayer manuellement.",
    },
    reserva_travada: {
      titulo: "Paiement en cours de vérification par l’équipe",
      texto: "Votre commande est enregistrée, mais cette tentative a pris plus de temps que prévu. Nous n’avons pas ouvert un autre prélèvement automatiquement, pour éviter un double paiement.",
      detalhe: "Copiez le numéro de commande ou ouvrez votre commande pour contacter l’équipe. L’équipe vérifie le prélèvement en attente avant d’autoriser une nouvelle tentative.",
    },
    metodo_indisponivel: {
      titulo: "Moyen de paiement indisponible",
      texto: "Votre commande est enregistrée et rien n’a été débité. Le moyen de paiement n’est pas disponible pour le moment.",
      detalhe: "Réessayez dans un instant. Si le problème persiste, ouvrez votre commande pour contacter l’équipe.",
    },
    internacional_indisponivel: {
      titulo: "Paiement international indisponible",
      texto: "Votre commande est enregistrée, mais nous ne pouvons pas encore ouvrir un paiement pour cette destination en toute sécurité.",
      detalhe: "Le prix, la livraison et le pays doivent être actifs avant de débiter une commande internationale. Ouvrez votre commande pour contacter l’équipe.",
    },
    link_bloqueado: {
      titulo: "Lien de paiement bloqué",
      texto: "Votre commande est enregistrée et rien n’a été débité. Le lien renvoyé par le prestataire de paiement n’a pas passé notre validation de sécurité.",
      detalhe: "Réessayez dans un instant. Si le problème persiste, ouvrez votre commande pour contacter l’équipe.",
    },
  },
  quandoAbrir: "À l’ouverture du paiement",
  infinitePayPix: "Pix apparaît comme option rapide dans le paiement InfinitePay.",
  infinitePayCartao: "La carte de crédit permet de finaliser immédiatement.",
  infinitePayCarteiras: "Apple Pay ou Google Pay apparaissent lorsque votre appareil et votre navigateur le permettent.",
  tentarNovamente: "Réessayer le paiement",
  verPedido: "Voir ma commande",
  copiarNumero: "Copier le numéro de commande",
  numeroCopiado: "Numéro copié",
  avisoSuporte: "Pour contacter l’équipe, envoyez le numéro de commande. Avant d’autoriser une nouvelle tentative, l’équipe vérifie s’il existe déjà un prélèvement en attente.",
  avisoContinuar: "Si le problème persiste, ouvrez « Voir ma commande » pour suivre la récupération sans créer un autre achat.",
  infoSuporte: "Informations pour le support",
  diagnostico: (n, motivo, suporte) => `Commande ${n}. Diagnostic : ${motivo}. ${suporte}`,
};

const DE: TextosPagamentoIndisponivel = {
  pedido: (n) => `Bestellung ${n}`,
  estados: {
    erro_tecnico: {
      titulo: "Die Zahlung konnte nicht geöffnet werden",
      texto: "Ihre Bestellung ist gespeichert und es wurde nichts abgebucht. Versuchen Sie in Kürze erneut, die Zahlung zu öffnen.",
      detalhe: "Wenn es weiterhin passiert, öffnen Sie Ihre Bestellung, um den Kauf zu verfolgen oder das Team zu kontaktieren, ohne eine neue Bestellung anzulegen.",
    },
    em_preparacao: {
      titulo: "Wir bereiten Ihre Zahlung vor",
      texto: "Ihre Bestellung ist gespeichert. Bitte warten Sie einen Moment; zu Ihrer Sicherheit öffnen wir keine zweite Abbuchung.",
      detalhe: "Die Seite versucht es einige Sekunden lang selbst erneut. Sie können es auch manuell noch einmal versuchen.",
    },
    reserva_travada: {
      titulo: "Zahlung wird vom Team geprüft",
      texto: "Ihre Bestellung ist gespeichert, aber dieser Versuch hat länger gedauert als erwartet. Wir haben nicht automatisch eine weitere Abbuchung geöffnet, um eine doppelte Zahlung zu vermeiden.",
      detalhe: "Kopieren Sie die Bestellnummer oder öffnen Sie Ihre Bestellung, um das Team zu kontaktieren. Das Team prüft die ausstehende Abbuchung, bevor ein neuer Versuch freigegeben wird.",
    },
    metodo_indisponivel: {
      titulo: "Zahlungsmethode nicht verfügbar",
      texto: "Ihre Bestellung ist gespeichert und es wurde nichts abgebucht. Die Zahlungsmethode ist derzeit nicht verfügbar.",
      detalhe: "Versuchen Sie es in Kürze erneut. Wenn es weiterhin passiert, öffnen Sie Ihre Bestellung, um das Team zu kontaktieren.",
    },
    internacional_indisponivel: {
      titulo: "Internationale Zahlung nicht verfügbar",
      texto: "Ihre Bestellung ist gespeichert, aber wir können für dieses Zielland noch keine Zahlung sicher öffnen.",
      detalhe: "Preis, Versand und Land müssen aktiv sein, bevor eine internationale Bestellung abgebucht werden kann. Öffnen Sie Ihre Bestellung, um das Team zu kontaktieren.",
    },
    link_bloqueado: {
      titulo: "Zahlungslink blockiert",
      texto: "Ihre Bestellung ist gespeichert und es wurde nichts abgebucht. Der vom Zahlungsanbieter zurückgegebene Link hat unsere Sicherheitsprüfung nicht bestanden.",
      detalhe: "Versuchen Sie es in Kürze erneut. Wenn es weiterhin passiert, öffnen Sie Ihre Bestellung, um das Team zu kontaktieren.",
    },
  },
  quandoAbrir: "Wenn sich der Checkout öffnet",
  infinitePayPix: "Pix erscheint als schnelle Option im InfinitePay-Checkout.",
  infinitePayCartao: "Kreditkarte steht zum sofortigen Abschluss zur Verfügung.",
  infinitePayCarteiras: "Apple Pay oder Google Pay erscheinen, wenn Ihr Gerät und Browser es erlauben.",
  tentarNovamente: "Zahlung erneut versuchen",
  verPedido: "Meine Bestellung ansehen",
  copiarNumero: "Bestellnummer kopieren",
  numeroCopiado: "Nummer kopiert",
  avisoSuporte: "Wenn Sie das Team kontaktieren möchten, senden Sie die Bestellnummer. Bevor ein neuer Versuch freigegeben wird, prüft das Team, ob bereits eine ausstehende Abbuchung existiert.",
  avisoContinuar: "Wenn es weiterhin passiert, öffnen Sie „Meine Bestellung ansehen“, um die Wiederherstellung zu verfolgen, ohne einen weiteren Kauf anzulegen.",
  infoSuporte: "Informationen für den Support",
  diagnostico: (n, motivo, suporte) => `Bestellung ${n}. Diagnose: ${motivo}. ${suporte}`,
};

export const TEXTOS_PAGAMENTO_INDISPONIVEL: Record<Idioma, TextosPagamentoIndisponivel> = {
  pt: PT,
  en: EN,
  es: ES,
  fr: FR,
  de: DE,
};

export function textosPagamentoIndisponivel(idioma: Idioma): TextosPagamentoIndisponivel {
  return TEXTOS_PAGAMENTO_INDISPONIVEL[idioma] ?? PT;
}
