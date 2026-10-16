import type { Idioma } from "./idioma";

export const ERROS_COTACAO: Record<Idioma, {
  indisponivel: string;
  limite: (segundos: number) => string;
  mudou: string;
  manual: string;
  meioIndisponivel: string;
  mercadoFechado: string;
  cambio: string;
  dhlEndereco: string;
  dhlServico: string;
  dhlAmbiente: string;
  assinatura: string;
  gravarCotacao: string;
  criarPedido: string;
  registrarItens: string;
}> = {
  pt: {
    indisponivel: "A consulta de frete está temporariamente indisponível. Tente novamente mais tarde.",
    limite: (s) => `Muitas consultas de frete. Aguarde ${s} segundos e tente novamente.`,
    mudou: "A cotação expirou ou mudou na nova consulta da DHL. Confira as condições atualizadas e confirme novamente.",
    manual: "Este carrinho precisa de uma cotação DHL feita pela nossa equipe.",
    meioIndisponivel: "Este meio de pagamento não está disponível agora.",
    mercadoFechado: "Não foi possível concluir: as vendas para este destino não estão disponíveis no momento.",
    cambio: "Não foi possível calcular o câmbio agora. Tente novamente em instantes.",
    dhlEndereco: "A DHL não conseguiu calcular o frete para este endereço agora. Confira os dados ou tente novamente.",
    dhlServico: "A DHL não retornou um serviço de envio compatível para este endereço.",
    dhlAmbiente: "O frete internacional está temporariamente indisponível para pagamento.",
    assinatura: "Não foi possível validar a cotação. Tente novamente em instantes.",
    gravarCotacao: "Não foi possível confirmar a cotação DHL. Tente novamente.",
    criarPedido: "Não foi possível criar o pedido agora. Tente novamente em instantes.",
    registrarItens: "Não foi possível registrar os itens do pedido. Tente novamente.",
  },
  en: {
    indisponivel: "Shipping quotes are temporarily unavailable. Please try again later.",
    limite: (s) => `Too many shipping quote requests. Wait ${s} seconds and try again.`,
    mudou: "The quote expired or changed after the DHL recheck. Review the updated shipping conditions and confirm again.",
    manual: "This cart requires a DHL quote prepared by our team.",
    meioIndisponivel: "This payment method is not available right now.",
    mercadoFechado: "We could not complete this: sales to this destination are not available at the moment.",
    cambio: "We could not calculate the exchange rate right now. Please try again in a moment.",
    dhlEndereco: "DHL could not calculate shipping for this address right now. Check the details or try again.",
    dhlServico: "DHL did not return a compatible shipping service for this address.",
    dhlAmbiente: "International shipping is temporarily unavailable for payment.",
    assinatura: "We could not validate the quote. Please try again in a moment.",
    gravarCotacao: "We could not confirm the DHL quote. Please try again.",
    criarPedido: "We could not create the order right now. Please try again in a moment.",
    registrarItens: "We could not register the order items. Please try again.",
  },
  es: {
    indisponivel: "Las cotizaciones de envío no están disponibles temporalmente. Inténtalo más tarde.",
    limite: (s) => `Hay demasiadas consultas de envío. Espera ${s} segundos e inténtalo de nuevo.`,
    mudou: "La cotización venció o cambió al volver a consultar DHL. Revisa las condiciones actualizadas y confirma de nuevo.",
    manual: "Este carrito necesita una cotización DHL preparada por nuestro equipo.",
    meioIndisponivel: "Este medio de pago no está disponible ahora.",
    mercadoFechado: "No fue posible concluir: las ventas a este destino no están disponibles en este momento.",
    cambio: "No fue posible calcular el cambio ahora. Inténtalo de nuevo en unos instantes.",
    dhlEndereco: "DHL no pudo calcular el envío para esta dirección ahora. Revisa los datos o inténtalo de nuevo.",
    dhlServico: "DHL no devolvió un servicio de envío compatible para esta dirección.",
    dhlAmbiente: "El envío internacional no está disponible temporalmente para el pago.",
    assinatura: "No fue posible validar la cotización. Inténtalo de nuevo en unos instantes.",
    gravarCotacao: "No fue posible confirmar la cotización DHL. Inténtalo de nuevo.",
    criarPedido: "No fue posible crear el pedido ahora. Inténtalo de nuevo en unos instantes.",
    registrarItens: "No fue posible registrar los artículos del pedido. Inténtalo de nuevo.",
  },
  fr: {
    indisponivel: "Les tarifs de livraison sont temporairement indisponibles. Réessayez plus tard.",
    limite: (s) => `Trop de demandes de tarif. Attendez ${s} secondes puis réessayez.`,
    mudou: "Le tarif a expiré ou changé après la nouvelle vérification DHL. Vérifiez les conditions mises à jour et confirmez à nouveau.",
    manual: "Ce panier nécessite un tarif DHL préparé par notre équipe.",
    meioIndisponivel: "Ce moyen de paiement n’est pas disponible pour le moment.",
    mercadoFechado: "Impossible de finaliser : les ventes vers cette destination ne sont pas disponibles pour le moment.",
    cambio: "Impossible de calculer le taux de change pour le moment. Réessayez dans un instant.",
    dhlEndereco: "DHL n’a pas pu calculer la livraison pour cette adresse. Vérifiez les informations ou réessayez.",
    dhlServico: "DHL n’a renvoyé aucun service de livraison compatible pour cette adresse.",
    dhlAmbiente: "La livraison internationale est temporairement indisponible pour le paiement.",
    assinatura: "Impossible de valider le tarif. Réessayez dans un instant.",
    gravarCotacao: "Impossible de confirmer le tarif DHL. Réessayez.",
    criarPedido: "Impossible de créer la commande pour le moment. Réessayez dans un instant.",
    registrarItens: "Impossible d’enregistrer les articles de la commande. Réessayez.",
  },
  de: {
    indisponivel: "Versandangebote sind vorübergehend nicht verfügbar. Versuchen Sie es später erneut.",
    limite: (s) => `Zu viele Versandanfragen. Warten Sie ${s} Sekunden und versuchen Sie es erneut.`,
    mudou: "Das Angebot ist abgelaufen oder hat sich nach der erneuten DHL-Prüfung geändert. Prüfen Sie die aktualisierten Bedingungen und bestätigen Sie erneut.",
    manual: "Für diesen Warenkorb muss unser Team ein DHL-Angebot erstellen.",
    meioIndisponivel: "Diese Zahlungsmethode ist derzeit nicht verfügbar.",
    mercadoFechado: "Abschluss nicht möglich: Verkäufe in dieses Zielland sind derzeit nicht verfügbar.",
    cambio: "Der Wechselkurs konnte gerade nicht berechnet werden. Versuchen Sie es in Kürze erneut.",
    dhlEndereco: "DHL konnte den Versand für diese Adresse gerade nicht berechnen. Prüfen Sie die Angaben oder versuchen Sie es erneut.",
    dhlServico: "DHL hat keinen passenden Versandservice für diese Adresse zurückgegeben.",
    dhlAmbiente: "Der internationale Versand ist vorübergehend nicht für die Zahlung verfügbar.",
    assinatura: "Das Angebot konnte nicht validiert werden. Versuchen Sie es in Kürze erneut.",
    gravarCotacao: "Das DHL-Angebot konnte nicht bestätigt werden. Versuchen Sie es erneut.",
    criarPedido: "Die Bestellung konnte gerade nicht angelegt werden. Versuchen Sie es in Kürze erneut.",
    registrarItens: "Die Artikel der Bestellung konnten nicht gespeichert werden. Versuchen Sie es erneut.",
  },
};
