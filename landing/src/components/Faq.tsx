import { useId, useState } from 'preact/hooks';
import { trackEvent } from '../lib/analytics';
import { getDictionary } from '../i18n';
import type { Locale } from '../i18n';

const supportUrl = 'https://t.me/dreamwheelsai';
const questionMeta = [
  { id: 'visual_accuracy', label: '01 / VISUAL' },
  { id: 'support_issue', label: '02 / SUPPORT' },
  { id: 'storage', label: '03 / STORAGE' },
  { id: 'privacy', label: '04 / PRIVACY' },
  { id: 'fitment', label: '05 / FITMENT' },
  { id: 'fitment_data', label: '06 / DATA' },
  { id: 'visual_vs_fitment', label: '07 / VISUAL ≠ FITMENT' },
  { id: 'real_installation', label: '08 / REALITY' },
] as const;

export default function Faq({ locale }: { locale: Locale }) {
  const copy = getDictionary(locale).faq;
  const [openedId, setOpenedId] = useState<string>(questionMeta[0].id);
  const sectionId = useId();

  return <section class="faq" id="faq" aria-labelledby="faq-title">
    <img class="faq__background" src="/assets/mock/faq-garage-wheel.webp" width="1672" height="941" alt="" aria-hidden="true" loading="lazy" decoding="async" />
    <div class="faq__content">
      <div class="faq__header">
        <div>
          <p class="faq__eyebrow">{copy.eyebrow}</p>
          <h2 id="faq-title">{copy.title[0]}<br />{copy.title[1]}</h2>
        </div>
        <a class="faq__support" href={supportUrl} target="_blank" rel="noreferrer" data-support-link data-support-source="faq">
          <span>{copy.supportPrompt}</span>
          <strong>{copy.supportAction} <i aria-hidden="true">→</i></strong>
        </a>
      </div>
      <div class="faq__list">
        {questionMeta.map((meta, index) => {
          const item = copy.questions[index];
          const isOpen = meta.id === openedId;
          const answerId = `${sectionId}-${meta.id}`;
          return <article class={`faq__item${isOpen ? ' is-open' : ''}`} key={meta.id}>
            <button class="faq__trigger" type="button" aria-expanded={isOpen} aria-controls={answerId} onClick={() => {
              if (!isOpen) {
                setOpenedId(meta.id);
                trackEvent('faq_opened', { question_id: meta.id });
              }
            }}>
              <span class="faq__meta">{meta.label}</span>
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
