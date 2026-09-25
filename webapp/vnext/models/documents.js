export function documentsViewModel() {
  return Object.freeze({
    title: "Документы",
    eyebrow: "Правовая информация",
    copy: "Здесь собраны документы, которые относятся к использованию сервиса, оплате и обработке персональных данных.",
    rows: [
      {
        title: "Политика конфиденциальности",
        copy: "Как сервис обрабатывает и защищает пользовательские данные.",
        href: "https://legal.dreamwheels.pro/legal/privacy",
      },
      {
        title: "Публичная оферта",
        copy: "Условия приобретения и использования рендеров.",
        href: "https://legal.dreamwheels.pro/legal/offer",
      },
      {
        title: "Условия возврата",
        copy: "Порядок возврата оплаты в предусмотренных случаях.",
        href: "https://legal.dreamwheels.pro/legal/refund",
      },
      {
        title: "Согласие на обработку персональных данных",
        copy: "Условия обработки данных, необходимых для работы сервиса.",
        href: "https://legal.dreamwheels.pro/legal/consent",
      },
    ],
  });
}
