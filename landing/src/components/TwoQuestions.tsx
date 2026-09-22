const questions = [
  {
    id: 'how-it-looks',
    index: 'SYSTEM 01',
    heading: ['КАК БУДУТ', 'СМОТРЕТЬСЯ?'],
    body: <>Оцените конкретные диски<br />на своём автомобиле</>,
    product: 'Race Ready Technology CSS3347',
    specs: '8,5/19" 5x108 ET45 DIA63,4 MK/M',
    image: {
      src: '/assets/two-questions/how-it-looks/zeekr-001-race-ready-v2.png',
      width: 2048,
      height: 2048,
      alt: 'Оранжевый Zeekr 001 с диском Race Ready Technology CSS3347',
    },
  },
  {
    id: 'parameters',
    index: 'SYSTEM 02',
    heading: ['ПОДХОДИТ ЛИ', 'ПО ПАРАМЕТРАМ?'],
    body: <>Проверьте совместимость диска<br />и автомобиля по техническим параметрам</>,
    image: {
      src: '/assets/two-questions/parameters/workshop-fitment-vertical.png',
      width: 1122,
      height: 1402,
      alt: 'Мастер устанавливает колесо рядом со ступицей и тормозным диском автомобиля',
    },
  },
] as const;

export default function TwoQuestions() {
  return (
    <section class="two-questions" id="two-questions" aria-label="Как выглядит и подходит ли по параметрам">
      {questions.map((question) => (
        <article class={`two-question two-question--${question.id}`} key={question.id}>
          <img
            class="two-question__image"
            src={question.image.src}
            width={question.image.width}
            height={question.image.height}
            alt={question.image.alt}
            loading="lazy"
            decoding="async"
          />
          <div class="two-question__readability" aria-hidden="true" />
          <div class="two-question__content">
            <span class="two-question__index" aria-hidden="true">{question.index}</span>
            <h2>{question.heading.map((line) => <span key={line}>{line}</span>)}</h2>
            <p>{question.body}</p>
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
