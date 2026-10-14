import { copy as uiText, applicationLocale } from "../copy.mjs";
export function photoGuideViewModel(locale = applicationLocale()) {
  return Object.freeze({
    locale,
    title: uiText("nav.photoGuide", locale),
    eyebrow: uiText("photoguide.visualTryOn", locale),
    heroTitle: uiText("photoguide.thePhotoShouldClearlyShowTheVehicleAndWheels", locale),
    copy: uiText("photoguide.aClearOriginalPhotoMakesItEasierToPreserve", locale),
    examples: [
      {
        tone: "good",
        toneLabel: uiText("photoguide.suitableForATryOn", locale),
        title: uiText("photoguide.theWholeCarIsVisible", locale),
        copy: uiText("photoguide.theWheelsAreClearlyVisibleThePerspectiveIsClear", locale),
        src: "/assets/photo-guide-kia-sorento.jpg",
        alt: uiText("photoguide.aSilverVehicleFullyInFrameWithBothWheels", locale),
      },
      {
        tone: "bad",
        toneLabel: uiText("photoguide.chooseADifferentPhoto", locale),
        title: uiText("photoguide.partOfTheVehicleIsOutOfFrame", locale),
        copy: uiText("photoguide.ifTheBodyOrAWheelIsCroppedThe", locale),
        src: "/assets/photo-guide-porsche-fragment.jpg",
        cropped: true,
        alt: locale === "ru" ? "Край Porsche справа: автомобиль почти полностью вне кадра, колесо видно лишь частично" : "Edge of the Porsche on the right: almost all of the car and part of its wheel are outside the frame",
      },
    ],
    rulesTitle: locale === "ru" ? "Перед загрузкой проверьте" : "Check before uploading",
    rules: locale === "ru" ? [
      ["", "Автомобиль целиком", "Оставьте немного пространства вокруг кузова."],
      ["", "Колёса видны", "Их не закрывают бордюр, трава или другие объекты."],
      ["", "Фото чёткое", "Без сильного смаза и заметной пикселизации."],
      ["", "Без фильтров", "Загрузите фото без эффектов и изменения перспективы."],
    ] : [
      ["", "Whole car visible", "Leave a little space around the body."],
      ["", "Wheels visible", "Keep curbs, grass and other objects out of the way."],
      ["", "Sharp photo", "Avoid strong blur and visible pixelation."],
      ["", "No filters", "Upload without effects or perspective changes."],
    ],
  });
}
