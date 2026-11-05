import { getDictionary } from '../i18n';
import type { Locale } from '../i18n';

const questions = [
  {
    id: 'how-it-looks',
    index: 'SYSTEM 01',
    product: 'Race Ready Technology CSS3347',
    specs: '8,5/19" 5x108 ET45 DIA63,4 MK/M',
    image: {
      src: '/assets/two-questions/how-it-looks/zeekr-001-race-ready-v2.webp',
      width: 2048,
      height: 2048,
    },
  },
  {
    id: 'parameters',
    index: 'SYSTEM 02',
    image: {
      src: '/assets/two-questions/parameters/workshop-fitment-vertical.webp',
      width: 1122,
      height: 1402,
    },
  },
] as const;

export default function TwoQuestions({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).twoQuestions;
  return (
    <section class="two-questions" id="two-questions" aria-label={copy.sectionLabel}>
      {questions.map((question, index) => (
        <article class={`two-question two-question--${question.id}`} key={question.id}>
          <img
            class="two-question__image"
            src={question.image.src}
            width={question.image.width}
            height={question.image.height}
            alt={copy.cards[index].imageAlt}
            loading="lazy"
            decoding="async"
          />
          <div class="two-question__readability" aria-hidden="true" />
          <div class="two-question__content">
            <span class="two-question__index" aria-hidden="true">{question.index}</span>
            <h2>{copy.cards[index].heading.map((line) => <span key={line}>{line}</span>)}</h2>
            <p>{copy.cards[index].body[0]}<br />{copy.cards[index].body[1]}</p>
            {'product' in question && question.product ? (
              <span class="two-question__label">
                <span class="two-question__product">{question.product}</span>
                <span class="two-question__specs">{question.specs}</span>
              </span>
            ) : null}
          </div>
        </article>
      ))}
      <div class="two-questions__bridge" aria-hidden="true" />
    </section>
  );
}
