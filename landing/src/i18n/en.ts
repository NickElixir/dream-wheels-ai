import type { Dictionary } from './types';

export const en: Dictionary = {
  meta: {
    landingTitle: 'Dream Wheels — Preview wheels on your car',
    landingDescription: 'Preview selected wheels on your car and explore preliminary fitment information.',
    catalogTitle: 'Wheel Catalog — Dream Wheels',
    catalogDescription: 'Choose a car and explore available wheel options.',
  },
  nav: { brand: 'DREAM WHEELS', homeLabel: 'Dream Wheels — home', navigationLabel: 'Main navigation', catalog: 'Catalog', howItWorks: 'How it works', faq: 'FAQ', login: 'Log in', languageLabel: 'Site language' },
  hero: { imageAlt: 'Geely Monjaro in an open garage', welcome: 'Welcome to', brand: 'Dream Wheels', subtitle: ['Preview selected wheels', 'on your own car'], cta: 'Try it', helper: 'Your first 3 try-ons are free', slogan: ['YOUR CAR', 'YOUR WHEELS', 'YOUR CONFIDENCE'] },
  twoQuestions: { sectionLabel: 'How will they look and will they fit?', cards: [
    { heading: ['HOW WILL THEY', 'LOOK?'], body: ['See specific wheels', 'on your own car'], imageAlt: 'Orange Zeekr 001 with Race Ready Technology CSS3347 wheels' },
    { heading: ['WILL THEY', 'FIT?'], body: ['Check wheel-to-car fitment', 'against technical specifications'], imageAlt: 'Technician fitting a wheel beside a car hub and brake disc' },
  ] },
  howItWorks: { sectionLabel: 'How the visual try-on works', sourceAlt: 'Orange Zeekr 001 before a visual wheel try-on', resultAlt: 'Orange Zeekr 001 after a visual try-on with Race Ready CSS3347 wheels', vortexAlt: 'Abstract visual representing Dream Wheels image processing', photo: 'Upload a photo of your car', wheel: 'Choose a wheel', visualize: 'See the visual try-on', result: 'See the result before installation' },
  comparison: { sliderLabel: 'Compare original and selected wheels', valueText: (percent) => `${percent}%: before on the left, after on the right`, imageAlt: "Geely Monjaro with X'trike X-141 wheels", eyebrow: 'VISUALIZATION EXAMPLE', before: 'BEFORE', after: 'AFTER', cta: 'Try it on your car', catalog: 'Explore the wheel catalog' },
  faq: { eyebrow: 'FAQ / DREAM WHEELS', title: ['Frequently asked', 'questions'], supportPrompt: 'MORE QUESTIONS?', supportAction: 'Contact support', questions: [
    { question: 'How accurately does the visualization show what the wheels will really look like?', answer: [
      'Dream Wheels aims to preserve the original car, camera angle, lighting and shape of the selected wheel as closely as the source material allows.',
      'The visualization is still an AI-generated image. Reflections, colors, perspective and small details may differ.',
      'It helps you assess the look before purchase; it does not replace a photo taken after installation.',
    ] },
    { question: 'What if the visualization looks inaccurate or I do not like the result?', answer: [
      'If the result contains a clear error or does not look as expected, contact support and include the specific example.',
      'That helps us investigate the original photo, selected wheel and resulting visualization.',
    ] },
    { question: 'How long are my visualizations stored?', answer: [
      'Completed visualizations are saved in your account history so you can return to them later.',
      'Storage periods and deletion options will be described in the data retention policy and service settings.',
    ] },
    { question: 'Where are uploaded photos of my car and wheels stored?', answer: [
      'Photos are used to operate the service and are linked to your account and the visualizations you create.',
      'They do not become public automatically. The Privacy Policy describes the conditions for storing, processing and deleting data.',
    ] },
    { question: 'How do you check whether a wheel fits my car?', answer: [
      'Fitment is checked separately from visualization.',
      'Dream Wheels compares available car and wheel specifications, including PCD, center bore, wheel width and diameter, offset (ET) and other available fitment data.',
      'A convincing visual try-on does not, by itself, confirm that the wheel is technically compatible with your car.',
    ] },
    { question: 'What data do you use for the fitment check?', answer: [
      'Dream Wheels uses specialist fitment sources, including Wheel-Size API, for car data and original equipment sizes.',
      'Wheel-Size provides data for specific makes, models, generations, versions and markets, including factory and alternative wheel sizes, PCD, ET, DIA and mounting specifications.',
      'The Dream Wheels result is based on available technical data. Confirm compatibility with the seller or installer before buying or fitting wheels.',
    ] },
    { question: 'Can a wheel look right in the visualization but be technically incompatible?', answer: [
      'Yes. These are two separate questions.',
      'A visual try-on shows how the wheels may look on your car.',
      'A fitment check compares their technical specifications with the car.',
      'Dream Wheels keeps these functions separate so a visual result is not mistaken for confirmation of physical compatibility.',
    ] },
    { question: 'Why might the result differ from how my car looks after the wheels are installed?', answer: [
      'The real appearance depends on the exact wheel size, width and offset, tires, vehicle ride height, lighting and camera angle, as well as the wheel design.',
      'AI visualization helps you assess the overall look and proportions, but small differences from the real installation are possible.',
    ] },
  ] },
  footer: { brand: 'DREAM WHEELS', copyright: '© 2026 DREAM WHEELS', navigationLabel: 'Footer navigation', support: 'Support', email: 'dreamwheelai@gmail.com', privacy: 'Privacy Policy (Russian)', agreement: 'Public Offer (Russian)' },
  catalog: { title: 'Wheel Catalog', subtitle: 'Choose a car and explore available options.', selectVehicle: 'Choose a car', selectWheels: 'Choose wheels', selectWheel: 'Choose a wheel', specsLabel: 'Selected wheel specifications', diameter: 'Diameter', width: 'Width', offset: 'Offset', unknown: 'Fitment check needed', preliminary: 'Preliminary fitment match', addFavorite: 'Add to favorites', removeFavorite: 'Remove from favorites', note: 'A visual try-on does not confirm technical fitment.', preview: 'preview', tagline: 'A motorsport classic.', finishes: { 'wheel-a': 'Satin graphite', 'wheel-b': 'Brushed silver', 'wheel-c': 'Brushed silver' }, imageAlt: (vehicle) => `${vehicle} in a dark garage` },
};
