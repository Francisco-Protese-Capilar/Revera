import type { Idioma } from "@/lib/internacional/idioma";

/**
 * Textos do formulário NACIONAL (CEP/UF/CPF, Pix/cartão) nas cinco línguas
 * (item 1 das pendências da auditoria de 15/10/2026).
 *
 * O português é o texto de sempre, byte a byte: quem compra para o Brasil
 * lendo em português não vê diferença nenhuma. As outras línguas entram só
 * quando a pessoa escolheu outro idioma e mesmo assim entrega no Brasil.
 * Nomes próprios do mercado (CEP, UF, CPF, Pix) ficam como são.
 *
 * Módulo puro, sem React, usado pelo formulário (cliente), pelo schema e
 * pela Server Action (servidor) — e pelos testes.
 */
export interface TextosNacional {
  seusDados: string;
  nome: string;
  email: string;
  telefone: string;
  telefoneHint: string;
  cpf: string;
  enderecoEntrega: string;
  cep: string;
  cepBuscando: string;
  cepCalculando: string;
  cepHint: string;
  calcularFrete: string;
  calculando: string;
  rua: string;
  numero: string;
  complemento: string;
  opcional: string;
  bairro: string;
  cidade: string;
  uf: string;
  formaPagamento: string;
  pixOuCartao: string;
  pixOuCartaoTexto: string;
  carteiras: string;
  carteirasTexto: string;
  seuPedido: string;
  alterarSacola: string;
  resumoSubtotal: string;
  resumoDesconto: string;
  resumoFrete: string;
  resumoTotal: string;
  freteCalculando: string;
  fretePreenchaCep: string;
  prazo: (dias: number) => string;
  ajudaFrete: string;
  falarWhatsApp: string;
  enviando: string;
  sacolaVaziaBotao: string;
  calculandoFreteBotao: string;
  finalizar: string;
  /* mensagens do navegador */
  cepIndisponivel: string;
  cepNaoEncontrado: string;
  freteIndisponivel: string;
  sacolaVazia: string;
  falhaEnvio: string;
  /* mensagens do servidor (schema + action) */
  soBrasil: string;
  erroNome: string;
  erroEmail: string;
  erroTelefone: string;
  erroCpf: string;
  erroCep: string;
  erroRua: string;
  erroNumero: string;
  erroBairro: string;
  erroCidade: string;
  erroUf: string;
  confiraCampos: string;
  pedidoEmAndamento: string;
  registrarDados: string;
  registrarEndereco: string;
  freteNaoCalculado: string;
  criarPedido: string;
  registrarItens: string;
  registrarItensBloqueado: string;
}

const PT: TextosNacional = {
  seusDados: "Seus dados",
  nome: "Nome completo",
  email: "E-mail",
  telefone: "Telefone",
  telefoneHint: "Com DDD, para contato sobre o envio.",
  cpf: "CPF",
  enderecoEntrega: "Endereço de entrega",
  cep: "CEP",
  cepBuscando: "Buscando endereço…",
  cepCalculando: "Calculando o frete…",
  cepHint: "Preenche rua, bairro, cidade e UF — e calcula o frete.",
  calcularFrete: "Calcular frete",
  calculando: "Calculando…",
  rua: "Rua",
  numero: "Número",
  complemento: "Complemento",
  opcional: "Opcional.",
  bairro: "Bairro",
  cidade: "Cidade",
  uf: "UF",
  formaPagamento: "Forma de pagamento",
  pixOuCartao: "Pix ou cartão",
  pixOuCartaoTexto: "Opções nacionais no checkout seguro.",
  carteiras: "Apple Pay, Google Pay ou cartão pela Stripe",
  carteirasTexto: "A carteira disponível aparece em dispositivos compatíveis; cartão fica como alternativa.",
  seuPedido: "Seu pedido",
  alterarSacola: "Alterar a sacola",
  resumoSubtotal: "Subtotal",
  resumoDesconto: "Desconto",
  resumoFrete: "Frete",
  resumoTotal: "Total",
  freteCalculando: "calculando…",
  fretePreenchaCep: "preencha o CEP acima",
  prazo: (dias) => ` — chega em cerca de ${dias} ${dias === 1 ? "dia útil" : "dias úteis"} após a postagem.`,
  ajudaFrete: "A equipe pode confirmar esse frete manualmente. O link ja leva o CEP e os itens da sacola para agilizar o atendimento.",
  falarWhatsApp: "Falar no WhatsApp",
  enviando: "Enviando…",
  sacolaVaziaBotao: "Sua sacola está vazia",
  calculandoFreteBotao: "Calculando frete…",
  finalizar: "Finalizar pedido",
  cepIndisponivel: "Não foi possível consultar o CEP agora — preencha o endereço manualmente.",
  cepNaoEncontrado: "CEP não encontrado — confira o número ou preencha o endereço manualmente.",
  freteIndisponivel:
    "Não conseguimos mostrar o frete agora. Vamos tentar recalcular com " +
    "segurança antes do pagamento; se continuar indisponível, você será " +
    "encaminhado para atendimento sem cobrança.",
  sacolaVazia: "Sua sacola está vazia — volte e adicione algo antes de finalizar.",
  falhaEnvio: "Não conseguimos enviar o pedido agora. Confira sua conexão e tente de novo; nada foi cobrado.",
  soBrasil: "Ainda entregamos apenas no Brasil.",
  erroNome: "Informe seu nome completo.",
  erroEmail: "E-mail inválido.",
  erroTelefone: "Telefone inválido — use DDD + número.",
  erroCpf: "CPF inválido — confira os números digitados.",
  erroCep: "CEP inválido — use o formato 00000-000.",
  erroRua: "Informe a rua.",
  erroNumero: "Informe o número.",
  erroBairro: "Informe o bairro.",
  erroCidade: "Informe a cidade.",
  erroUf: "UF precisa ter 2 letras (ex.: SP).",
  confiraCampos: "Confira os dados marcados acima.",
  pedidoEmAndamento:
    "Este pedido já está sendo finalizado. Aguarde um instante — se a tela " +
    "não avançar sozinha, confira seu e-mail antes de tentar de novo.",
  registrarDados: "Não foi possível registrar seus dados. Tente novamente.",
  registrarEndereco: "Não foi possível registrar o endereço. Tente novamente.",
  freteNaoCalculado:
    "Não conseguimos calcular o frete automaticamente agora. Seu pedido " +
    "não foi cobrado. Fale com a equipe para confirmar o envio e concluir " +
    "com segurança.",
  criarPedido: "Não foi possível criar o pedido agora. Tente novamente em instantes.",
  registrarItens: "Não foi possível registrar os itens do pedido. Tente novamente.",
  registrarItensBloqueado: "Não foi possível registrar os itens do pedido. A finalização está bloqueada para conferência; fale com a equipe.",
};

const EN: TextosNacional = {
  seusDados: "Your details",
  nome: "Full name",
  email: "Email",
  telefone: "Phone",
  telefoneHint: "With area code (DDD), for delivery contact.",
  cpf: "CPF (Brazilian tax ID)",
  enderecoEntrega: "Delivery address",
  cep: "CEP (postal code)",
  cepBuscando: "Looking up the address…",
  cepCalculando: "Calculating shipping…",
  cepHint: "Fills in street, neighborhood, city and state — and calculates shipping.",
  calcularFrete: "Calculate shipping",
  calculando: "Calculating…",
  rua: "Street",
  numero: "Number",
  complemento: "Address line 2",
  opcional: "Optional.",
  bairro: "Neighborhood",
  cidade: "City",
  uf: "State (UF)",
  formaPagamento: "Payment method",
  pixOuCartao: "Pix or card",
  pixOuCartaoTexto: "Brazilian options in the secure checkout.",
  carteiras: "Apple Pay, Google Pay or card via Stripe",
  carteirasTexto: "The available wallet appears on compatible devices; card stays as an alternative.",
  seuPedido: "Your order",
  alterarSacola: "Edit cart",
  resumoSubtotal: "Subtotal",
  resumoDesconto: "Discount",
  resumoFrete: "Shipping",
  resumoTotal: "Total",
  freteCalculando: "calculating…",
  fretePreenchaCep: "enter the CEP above",
  prazo: (dias) => ` — arrives in about ${dias} business ${dias === 1 ? "day" : "days"} after dispatch.`,
  ajudaFrete: "Our team can confirm this shipping manually. The link already carries the CEP and the cart items to speed things up.",
  falarWhatsApp: "Talk on WhatsApp",
  enviando: "Sending…",
  sacolaVaziaBotao: "Your cart is empty",
  calculandoFreteBotao: "Calculating shipping…",
  finalizar: "Place order",
  cepIndisponivel: "We could not look up the CEP right now — please fill in the address manually.",
  cepNaoEncontrado: "CEP not found — check the number or fill in the address manually.",
  freteIndisponivel:
    "We could not show the shipping cost right now. We will safely recalculate it " +
    "before payment; if it stays unavailable, you will be directed to support with no charge.",
  sacolaVazia: "Your cart is empty — go back and add something before placing the order.",
  falhaEnvio: "We could not send the order right now. Check your connection and try again; nothing was charged.",
  soBrasil: "This form delivers only within Brazil.",
  erroNome: "Enter your full name.",
  erroEmail: "Invalid email.",
  erroTelefone: "Invalid phone — use area code + number.",
  erroCpf: "Invalid CPF — check the digits.",
  erroCep: "Invalid CEP — use the format 00000-000.",
  erroRua: "Enter the street.",
  erroNumero: "Enter the number.",
  erroBairro: "Enter the neighborhood.",
  erroCidade: "Enter the city.",
  erroUf: "State must have 2 letters (e.g. SP).",
  confiraCampos: "Check the fields marked above.",
  pedidoEmAndamento:
    "This order is already being placed. Wait a moment — if the screen does not " +
    "move on by itself, check your email before trying again.",
  registrarDados: "We could not save your details. Please try again.",
  registrarEndereco: "We could not save the address. Please try again.",
  freteNaoCalculado:
    "We could not calculate shipping automatically right now. Your order was not " +
    "charged. Contact the team to confirm delivery and finish safely.",
  criarPedido: "We could not create the order right now. Please try again in a moment.",
  registrarItens: "We could not register the order items. Please try again.",
  registrarItensBloqueado: "We could not register the order items. Checkout is blocked for review; please contact the team.",
};

const ES: TextosNacional = {
  seusDados: "Tus datos",
  nome: "Nombre completo",
  email: "E-mail",
  telefone: "Teléfono",
  telefoneHint: "Con código de área (DDD), para contacto sobre el envío.",
  cpf: "CPF (documento fiscal brasileño)",
  enderecoEntrega: "Dirección de entrega",
  cep: "CEP (código postal)",
  cepBuscando: "Buscando dirección…",
  cepCalculando: "Calculando el envío…",
  cepHint: "Completa calle, barrio, ciudad y estado — y calcula el envío.",
  calcularFrete: "Calcular envío",
  calculando: "Calculando…",
  rua: "Calle",
  numero: "Número",
  complemento: "Complemento",
  opcional: "Opcional.",
  bairro: "Barrio",
  cidade: "Ciudad",
  uf: "Estado (UF)",
  formaPagamento: "Forma de pago",
  pixOuCartao: "Pix o tarjeta",
  pixOuCartaoTexto: "Opciones brasileñas en el checkout seguro.",
  carteiras: "Apple Pay, Google Pay o tarjeta por Stripe",
  carteirasTexto: "La billetera disponible aparece en dispositivos compatibles; la tarjeta queda como alternativa.",
  seuPedido: "Tu pedido",
  alterarSacola: "Cambiar el carrito",
  resumoSubtotal: "Subtotal",
  resumoDesconto: "Descuento",
  resumoFrete: "Envío",
  resumoTotal: "Total",
  freteCalculando: "calculando…",
  fretePreenchaCep: "completa el CEP arriba",
  prazo: (dias) => ` — llega en unos ${dias} ${dias === 1 ? "día hábil" : "días hábiles"} después del despacho.`,
  ajudaFrete: "El equipo puede confirmar este envío manualmente. El enlace ya lleva el CEP y los artículos del carrito para agilizar la atención.",
  falarWhatsApp: "Hablar por WhatsApp",
  enviando: "Enviando…",
  sacolaVaziaBotao: "Tu carrito está vacío",
  calculandoFreteBotao: "Calculando envío…",
  finalizar: "Finalizar pedido",
  cepIndisponivel: "No fue posible consultar el CEP ahora — completa la dirección manualmente.",
  cepNaoEncontrado: "CEP no encontrado — revisa el número o completa la dirección manualmente.",
  freteIndisponivel:
    "No pudimos mostrar el envío ahora. Lo recalcularemos con seguridad antes del pago; " +
    "si sigue sin estar disponible, te derivaremos a atención sin ningún cobro.",
  sacolaVazia: "Tu carrito está vacío — vuelve y añade algo antes de finalizar.",
  falhaEnvio: "No pudimos enviar el pedido ahora. Revisa tu conexión e inténtalo de nuevo; no se cobró nada.",
  soBrasil: "Este formulario entrega solo en Brasil.",
  erroNome: "Indica tu nombre completo.",
  erroEmail: "E-mail inválido.",
  erroTelefone: "Teléfono inválido — usa código de área + número.",
  erroCpf: "CPF inválido — revisa los dígitos.",
  erroCep: "CEP inválido — usa el formato 00000-000.",
  erroRua: "Indica la calle.",
  erroNumero: "Indica el número.",
  erroBairro: "Indica el barrio.",
  erroCidade: "Indica la ciudad.",
  erroUf: "El estado debe tener 2 letras (ej.: SP).",
  confiraCampos: "Revisa los campos marcados arriba.",
  pedidoEmAndamento:
    "Este pedido ya se está finalizando. Espera un momento — si la pantalla no avanza " +
    "sola, revisa tu e-mail antes de intentarlo de nuevo.",
  registrarDados: "No fue posible registrar tus datos. Inténtalo de nuevo.",
  registrarEndereco: "No fue posible registrar la dirección. Inténtalo de nuevo.",
  freteNaoCalculado:
    "No pudimos calcular el envío automáticamente ahora. Tu pedido no fue cobrado. " +
    "Habla con el equipo para confirmar el envío y concluir con seguridad.",
  criarPedido: "No fue posible crear el pedido ahora. Inténtalo de nuevo en unos instantes.",
  registrarItens: "No fue posible registrar los artículos del pedido. Inténtalo de nuevo.",
  registrarItensBloqueado: "No fue posible registrar los artículos del pedido. La finalización está bloqueada para revisión; habla con el equipo.",
};

const FR: TextosNacional = {
  seusDados: "Vos coordonnées",
  nome: "Nom complet",
  email: "E-mail",
  telefone: "Téléphone",
  telefoneHint: "Avec l’indicatif régional (DDD), pour le contact de livraison.",
  cpf: "CPF (identifiant fiscal brésilien)",
  enderecoEntrega: "Adresse de livraison",
  cep: "CEP (code postal)",
  cepBuscando: "Recherche de l’adresse…",
  cepCalculando: "Calcul de la livraison…",
  cepHint: "Remplit la rue, le quartier, la ville et l’État — et calcule la livraison.",
  calcularFrete: "Calculer la livraison",
  calculando: "Calcul…",
  rua: "Rue",
  numero: "Numéro",
  complemento: "Complément d’adresse",
  opcional: "Facultatif.",
  bairro: "Quartier",
  cidade: "Ville",
  uf: "État (UF)",
  formaPagamento: "Moyen de paiement",
  pixOuCartao: "Pix ou carte",
  pixOuCartaoTexto: "Options brésiliennes dans le paiement sécurisé.",
  carteiras: "Apple Pay, Google Pay ou carte via Stripe",
  carteirasTexto: "Le portefeuille disponible apparaît sur les appareils compatibles ; la carte reste une alternative.",
  seuPedido: "Votre commande",
  alterarSacola: "Modifier le panier",
  resumoSubtotal: "Sous-total",
  resumoDesconto: "Remise",
  resumoFrete: "Livraison",
  resumoTotal: "Total",
  freteCalculando: "calcul…",
  fretePreenchaCep: "saisissez le CEP ci-dessus",
  prazo: (dias) => ` — arrive en environ ${dias} ${dias === 1 ? "jour ouvré" : "jours ouvrés"} après l’expédition.`,
  ajudaFrete: "L’équipe peut confirmer cette livraison manuellement. Le lien contient déjà le CEP et les articles du panier pour accélérer le traitement.",
  falarWhatsApp: "Parler sur WhatsApp",
  enviando: "Envoi…",
  sacolaVaziaBotao: "Votre panier est vide",
  calculandoFreteBotao: "Calcul de la livraison…",
  finalizar: "Valider la commande",
  cepIndisponivel: "Impossible de consulter le CEP pour le moment — remplissez l’adresse manuellement.",
  cepNaoEncontrado: "CEP introuvable — vérifiez le numéro ou remplissez l’adresse manuellement.",
  freteIndisponivel:
    "Impossible d’afficher la livraison pour le moment. Nous la recalculerons en toute sécurité " +
    "avant le paiement ; si elle reste indisponible, vous serez dirigé vers le support sans aucun débit.",
  sacolaVazia: "Votre panier est vide — revenez en arrière et ajoutez un article avant de valider.",
  falhaEnvio: "Impossible d’envoyer la commande pour le moment. Vérifiez votre connexion et réessayez ; rien n’a été débité.",
  soBrasil: "Ce formulaire ne livre qu’au Brésil.",
  erroNome: "Indiquez votre nom complet.",
  erroEmail: "E-mail invalide.",
  erroTelefone: "Téléphone invalide — indicatif + numéro.",
  erroCpf: "CPF invalide — vérifiez les chiffres.",
  erroCep: "CEP invalide — utilisez le format 00000-000.",
  erroRua: "Indiquez la rue.",
  erroNumero: "Indiquez le numéro.",
  erroBairro: "Indiquez le quartier.",
  erroCidade: "Indiquez la ville.",
  erroUf: "L’État doit avoir 2 lettres (ex. : SP).",
  confiraCampos: "Vérifiez les champs signalés ci-dessus.",
  pedidoEmAndamento:
    "Cette commande est déjà en cours de validation. Patientez un instant — si l’écran " +
    "n’avance pas tout seul, vérifiez votre e-mail avant de réessayer.",
  registrarDados: "Impossible d’enregistrer vos coordonnées. Réessayez.",
  registrarEndereco: "Impossible d’enregistrer l’adresse. Réessayez.",
  freteNaoCalculado:
    "Impossible de calculer la livraison automatiquement pour le moment. Votre commande n’a pas " +
    "été débitée. Contactez l’équipe pour confirmer l’envoi et finaliser en toute sécurité.",
  criarPedido: "Impossible de créer la commande pour le moment. Réessayez dans un instant.",
  registrarItens: "Impossible d’enregistrer les articles de la commande. Réessayez.",
  registrarItensBloqueado: "Impossible d’enregistrer les articles de la commande. La validation est bloquée pour vérification ; contactez l’équipe.",
};

const DE: TextosNacional = {
  seusDados: "Ihre Daten",
  nome: "Vollständiger Name",
  email: "E-Mail",
  telefone: "Telefon",
  telefoneHint: "Mit Vorwahl (DDD), für Rückfragen zur Lieferung.",
  cpf: "CPF (brasilianische Steuernummer)",
  enderecoEntrega: "Lieferadresse",
  cep: "CEP (Postleitzahl)",
  cepBuscando: "Adresse wird gesucht…",
  cepCalculando: "Versand wird berechnet…",
  cepHint: "Füllt Straße, Stadtteil, Stadt und Bundesstaat aus — und berechnet den Versand.",
  calcularFrete: "Versand berechnen",
  calculando: "Wird berechnet…",
  rua: "Straße",
  numero: "Hausnummer",
  complemento: "Adresszusatz",
  opcional: "Optional.",
  bairro: "Stadtteil",
  cidade: "Stadt",
  uf: "Bundesstaat (UF)",
  formaPagamento: "Zahlungsart",
  pixOuCartao: "Pix oder Karte",
  pixOuCartaoTexto: "Brasilianische Optionen im sicheren Checkout.",
  carteiras: "Apple Pay, Google Pay oder Karte über Stripe",
  carteirasTexto: "Die verfügbare Wallet erscheint auf kompatiblen Geräten; die Karte bleibt als Alternative.",
  seuPedido: "Ihre Bestellung",
  alterarSacola: "Warenkorb ändern",
  resumoSubtotal: "Zwischensumme",
  resumoDesconto: "Rabatt",
  resumoFrete: "Versand",
  resumoTotal: "Gesamt",
  freteCalculando: "wird berechnet…",
  fretePreenchaCep: "CEP oben eingeben",
  prazo: (dias) => ` — kommt in etwa ${dias} ${dias === 1 ? "Werktag" : "Werktagen"} nach dem Versand an.`,
  ajudaFrete: "Das Team kann diesen Versand manuell bestätigen. Der Link enthält bereits die CEP und die Artikel im Warenkorb.",
  falarWhatsApp: "Per WhatsApp schreiben",
  enviando: "Wird gesendet…",
  sacolaVaziaBotao: "Ihr Warenkorb ist leer",
  calculandoFreteBotao: "Versand wird berechnet…",
  finalizar: "Bestellung abschließen",
  cepIndisponivel: "Die CEP konnte gerade nicht abgefragt werden — füllen Sie die Adresse bitte manuell aus.",
  cepNaoEncontrado: "CEP nicht gefunden — prüfen Sie die Nummer oder füllen Sie die Adresse manuell aus.",
  freteIndisponivel:
    "Der Versand kann gerade nicht angezeigt werden. Wir berechnen ihn vor der Zahlung sicher neu; " +
    "bleibt er nicht verfügbar, werden Sie ohne Abbuchung an den Support weitergeleitet.",
  sacolaVazia: "Ihr Warenkorb ist leer — gehen Sie zurück und legen Sie etwas hinein, bevor Sie bestellen.",
  falhaEnvio: "Die Bestellung konnte gerade nicht gesendet werden. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut; es wurde nichts abgebucht.",
  soBrasil: "Dieses Formular liefert nur innerhalb Brasiliens.",
  erroNome: "Geben Sie Ihren vollständigen Namen an.",
  erroEmail: "Ungültige E-Mail.",
  erroTelefone: "Ungültige Telefonnummer — Vorwahl + Nummer.",
  erroCpf: "Ungültige CPF — prüfen Sie die Ziffern.",
  erroCep: "Ungültige CEP — verwenden Sie das Format 00000-000.",
  erroRua: "Geben Sie die Straße an.",
  erroNumero: "Geben Sie die Hausnummer an.",
  erroBairro: "Geben Sie den Stadtteil an.",
  erroCidade: "Geben Sie die Stadt an.",
  erroUf: "Der Bundesstaat braucht 2 Buchstaben (z. B. SP).",
  confiraCampos: "Prüfen Sie die oben markierten Felder.",
  pedidoEmAndamento:
    "Diese Bestellung wird bereits abgeschlossen. Warten Sie einen Moment — wenn die Seite " +
    "nicht von selbst weitergeht, prüfen Sie Ihre E-Mails, bevor Sie es erneut versuchen.",
  registrarDados: "Ihre Daten konnten nicht gespeichert werden. Versuchen Sie es erneut.",
  registrarEndereco: "Die Adresse konnte nicht gespeichert werden. Versuchen Sie es erneut.",
  freteNaoCalculado:
    "Der Versand konnte gerade nicht automatisch berechnet werden. Ihre Bestellung wurde nicht " +
    "abgebucht. Kontaktieren Sie das Team, um die Lieferung zu bestätigen und sicher abzuschließen.",
  criarPedido: "Die Bestellung konnte gerade nicht angelegt werden. Versuchen Sie es in Kürze erneut.",
  registrarItens: "Die Artikel der Bestellung konnten nicht gespeichert werden. Versuchen Sie es erneut.",
  registrarItensBloqueado: "Die Artikel der Bestellung konnten nicht gespeichert werden. Der Abschluss ist zur Prüfung gesperrt; kontaktieren Sie das Team.",
};

export const TEXTOS_NACIONAL: Record<Idioma, TextosNacional> = { pt: PT, en: EN, es: ES, fr: FR, de: DE };

export function textosNacional(idioma: Idioma | null | undefined): TextosNacional {
  return (idioma && TEXTOS_NACIONAL[idioma]) || PT;
}
