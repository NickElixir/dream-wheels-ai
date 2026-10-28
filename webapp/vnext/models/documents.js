import { copy as uiText, applicationLocale } from "../copy.mjs";
export function documentsViewModel(locale = applicationLocale()) {
  return Object.freeze({
    locale,
    title: uiText("nav.documents", locale),
    eyebrow: uiText("documents.legalInformation", locale),
    copy: uiText("documents.theseDocumentsCoverUseOfTheServicePaymentsAnd", locale),
    rows: [
      {
        title: uiText("create.privacyPolicy", locale),
        copy: uiText("documents.howTheServiceProcessesAndProtectsUserData", locale),
        href: "https://legal.dreamwheels.pro/legal/privacy",
      },
      {
        title: uiText("documents.publicOffer", locale),
        copy: uiText("documents.termsForPurchasingAndUsingRenders", locale),
        href: "https://legal.dreamwheels.pro/legal/offer",
      },
      {
        title: uiText("documents.refundTerms", locale),
        copy: uiText("documents.howPaymentsAreRefundedInEligibleCases", locale),
        href: "https://legal.dreamwheels.pro/legal/refund",
      },
      {
        title: uiText("documents.consentToPersonalDataProcessing", locale),
        copy: uiText("documents.termsForProcessingTheDataRequiredToOperateThe", locale),
        href: "https://legal.dreamwheels.pro/legal/consent",
      },
    ],
  });
}
