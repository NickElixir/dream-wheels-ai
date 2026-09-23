export type Locale = 'ru' | 'en';

export interface Dictionary {
  meta: { landingTitle: string; landingDescription: string; catalogTitle: string; catalogDescription: string };
  nav: { brand: string; homeLabel: string; navigationLabel: string; catalog: string; howItWorks: string; faq: string; login: string; languageLabel: string };
  hero: { imageAlt: string; welcome: string; brand: string; subtitle: [string, string]; cta: string; helper: string; slogan: [string, string, string] };
  twoQuestions: { sectionLabel: string; cards: [
    { heading: [string, string]; body: [string, string]; imageAlt: string },
    { heading: [string, string]; body: [string, string]; imageAlt: string },
  ] };
  howItWorks: { sectionLabel: string; sourceAlt: string; resultAlt: string; vortexAlt: string; photo: string; wheel: string; visualize: string; result: string };
  comparison: { sliderLabel: string; valueText: (percent: number) => string; imageAlt: string; eyebrow: string; before: string; after: string; cta: string; catalog: string };
  faq: { eyebrow: string; title: [string, string]; supportPrompt: string; supportAction: string; questions: [
    { question: string; answer: string[] },
    { question: string; answer: string[] },
    { question: string; answer: string[] },
    { question: string; answer: string[] },
    { question: string; answer: string[] },
    { question: string; answer: string[] },
    { question: string; answer: string[] },
    { question: string; answer: string[] },
  ] };
  footer: { brand: string; copyright: string; navigationLabel: string; support: string; email: string; privacy: string; agreement: string };
  catalog: { title: string; subtitle: string; selectVehicle: string; selectWheels: string; selectWheel: string; specsLabel: string; diameter: string; width: string; offset: string; unknown: string; preliminary: string; addFavorite: string; removeFavorite: string; note: string; preview: string; tagline: string; finishes: Record<string, string>; imageAlt: (vehicle: string) => string };
}
