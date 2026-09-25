export function supportViewModel() {
  return Object.freeze({
    title: "Поддержка",
    copy: "Поможем с примеркой, оплатой или документами.",
    channels: [
      { label: "Telegram", detail: "@dreamwheelsai", href: "https://t.me/dreamwheelsai", external: true },
      { label: "Email", detail: "venus.mike@yandex.ru", href: "mailto:venus.mike@yandex.ru", external: false },
    ],
    documentsLabel: "Открыть документы",
  });
}
