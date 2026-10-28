import { copy as uiText, applicationLocale } from "../copy.mjs";
export function supportViewModel(locale = applicationLocale()) {
  return Object.freeze({
    locale,
    title: uiText("nav.support", locale),
    eyebrow: uiText("nav.help", locale),
    heroTitle: uiText("support.letSSolveTheProblem", locale),
    copy: uiText("support.describeWhatHappenedForQuestionsAboutGenerationPaymentOr", locale),
    messageLabel: uiText("support.message", locale),
    messagePlaceholder: uiText("support.forExampleTheWheelDetailsCouldNotBeUpdated", locale),
    supportLabel: uiText("support.contactSupport", locale),
    supportEmail: "dreamwheelsai@yandex.ru",
    supportSubject: "Dream Wheels Support",
    selfHelpTitle: uiText("support.thingsYouCanCheckYourself", locale),
    topics: [
      {
        label: uiText("support.howToPrepareAVehiclePhoto", locale),
        kind: "navigate",
        view: "photo-guide",
      },
      {
        label: uiText("support.whatToDoIfAWheelLinkWasNot", locale),
        kind: "detail",
        detail: uiText("support.tryADifferentLinkIfItStillCannotBe", locale),
      },
      {
        label: uiText("support.whyTheTechnicalCheckDoesNotBlockATry", locale),
        kind: "detail",
        detail: uiText("support.fitment", locale),
      },
      {
        label: uiText("support.paymentAndRenderExpiry", locale),
        kind: "detail",
        detail: uiText("support.yourBalanceRenderExpiryDatesAndTopUpHistory", locale),
      },
    ],
    documentsLabel: uiText("support.legalDocuments", locale),
  });
}
