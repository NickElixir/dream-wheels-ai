import { useId, useState } from 'preact/hooks';
import { trackEvent } from '../lib/analytics';

const supportUrl = 'https://t.me/dreamwheelsai';

const questions = [
  {
    id: 'visual_accuracy',
    label: '01 / VISUAL',
    question: 'Насколько точно визуализация передаёт реальный внешний вид дисков?',
    answer: [
      'Сервис «Колеса Мечты» старается сохранить исходный автомобиль, ракурс, освещение и форму выбранного диска максимально близко к исходным данным.',
      'При этом визуализация остаётся AI-изображением: возможны небольшие отличия в отражениях, оттенках, перспективе и мелких деталях.',
      'Её задача — помочь оценить внешний вид до покупки, а не заменить фотографию автомобиля после реальной установки.',
    ],
  },
  {
    id: 'support_issue', label: '02 / SUPPORT', question: 'Что делать, если результат визуализации выглядит неточно или мне не нравится?', answer: [
      'Если результат содержит заметную ошибку или не соответствует ожидаемому виду, обратитесь в поддержку и приложите конкретный пример.',
      'Это поможет разобрать проблему по исходному фото, выбранному диску и результату визуализации.',
    ],
  },
  {
    id: 'storage', label: '03 / STORAGE', question: 'Сколько хранятся мои визуализации?', answer: [
      'Готовые визуализации сохраняются в истории аккаунта, чтобы к ним можно было вернуться позже.',
      'Срок хранения и возможность удаления будут указаны в политике хранения данных и настройках сервиса.',
    ],
  },
  {
    id: 'privacy', label: '04 / PRIVACY', question: 'Где сохраняются загруженные фотографии автомобиля и дисков?', answer: [
      'Фотографии используются для работы сервиса и связываются с аккаунтом пользователя и созданными им визуализациями.',
      'Они не становятся публичными автоматически. Подробные условия хранения, обработки и удаления данных будут описаны в Политике конфиденциальности.',
    ],
  },
  {
    id: 'fitment', label: '05 / FITMENT', question: 'Как происходит проверка совместимости диска с автомобилем?', answer: [
      'Проверка выполняется отдельно от визуализации.',
      'Сервис «Колеса Мечты» сопоставляет параметры автомобиля и диска, включая PCD, диаметр центрального отверстия, ширину и диаметр диска, вылет ET и другие доступные fitment-параметры.',
      'Поэтому красивый результат виртуальной примерки сам по себе не означает, что диск технически подходит автомобилю.',
    ],
  },
  {
    id: 'fitment_data', label: '06 / DATA', question: 'На какие данные вы опираетесь при проверке совместимости?', answer: [
      'Для данных об автомобилях и штатных размерах сервис «Колеса Мечты» использует специализированные fitment-источники, включая Wheel-Size API.',
      'Wheel-Size предоставляет данные по конкретным маркам, моделям, поколениям, модификациям и рынкам, включая заводские и альтернативные размеры колёс, PCD, ET, DIA и параметры крепления.',
      'Результат «Колеса Мечты» — это проверка по доступным техническим данным. Перед покупкой или установкой дисков совместимость рекомендуется дополнительно подтвердить у продавца или установщика.',
    ],
  },
  {
    id: 'visual_vs_fitment', label: '07 / VISUAL ≠ FITMENT', question: 'Может ли диск выглядеть подходящим на визуализации, но не подходить технически?', answer: [
      'Да. Это две разные задачи.',
      'Виртуальная примерка отвечает на вопрос: «Как эти диски будут выглядеть на моей машине?»',
      'Проверка совместимости отвечает на вопрос: «Подходят ли они по техническим параметрам?»',
      'Сервис «Колеса Мечты» намеренно разделяет эти функции, чтобы не выдавать визуальный результат за подтверждение физической совместимости.',
    ],
  },
  {
    id: 'real_installation', label: '08 / REALITY', question: 'Почему результат может отличаться от того, как машина будет выглядеть после реальной установки?', answer: [
      'На реальный внешний вид влияют не только дизайн диска, но и его точный размер, ширина, вылет, шины, высота автомобиля, освещение и ракурс фотографии.',
      'AI-визуализация помогает оценить общий образ и пропорции, но небольшие различия с реальной установкой возможны.',
    ],
  },
];

export default function Faq() {
  const [openedId, setOpenedId] = useState(questions[0].id);
  const sectionId = useId();

  return <section class="faq" id="faq" aria-labelledby="faq-title">
    <img class="faq__background" src="/assets/mock/faq-garage-wheel.webp" width="1672" height="941" alt="" aria-hidden="true" loading="lazy" decoding="async" />
    <div class="faq__content">
      <div class="faq__header">
        <div>
          <p class="faq__eyebrow">FAQ / КОЛЕСА МЕЧТЫ</p>
          <h2 id="faq-title">Частые<br />вопросы</h2>
        </div>
        <a class="faq__support" href={supportUrl} target="_blank" rel="noreferrer" data-support-link data-support-source="faq">
          <span>ОСТАЛИСЬ ВОПРОСЫ?</span>
          <strong>Напишите в поддержку <i aria-hidden="true">→</i></strong>
        </a>
      </div>
      <div class="faq__list">
        {questions.map((item) => {
          const isOpen = item.id === openedId;
          const answerId = `${sectionId}-${item.id}`;
          return <article class={`faq__item${isOpen ? ' is-open' : ''}`} key={item.id}>
            <button class="faq__trigger" type="button" aria-expanded={isOpen} aria-controls={answerId} onClick={() => {
              if (!isOpen) {
                setOpenedId(item.id);
                trackEvent('faq_opened', { question_id: item.id });
              }
            }}>
              <span class="faq__meta">{item.label}</span>
              <span class="faq__question">{item.question}</span>
              <span class="faq__symbol" aria-hidden="true">{isOpen ? '−' : '+'}</span>
            </button>
            <div class="faq__answer-wrap" id={answerId} aria-hidden={!isOpen}>
              <div class="faq__answer">{item.answer.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}</div>
            </div>
          </article>;
        })}
      </div>
    </div>
  </section>;
}
