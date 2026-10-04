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
        src: "/assets/photo-guide-good-vnext.jpg",
        alt: uiText("photoguide.aSilverVehicleFullyInFrameWithBothWheels", locale),
      },
      {
        tone: "bad",
        toneLabel: uiText("photoguide.chooseADifferentPhoto", locale),
        title: uiText("photoguide.partOfTheVehicleIsOutOfFrame", locale),
        copy: uiText("photoguide.ifTheBodyOrAWheelIsCroppedThe", locale),
        src: "/assets/photo-guide-bad-vnext.jpg",
        alt: uiText("photoguide.aGreyVehiclePhotographedTooCloseWithBodyEdges", locale),
      },
    ],
    rules: [
      ["01", uiText("photoguide.showTheWholeVehicle", locale), uiText("photoguide.doNotCropTheFrontOrRearOfThe", locale)],
      ["02", uiText("photoguide.theWheelsMustBeVisible", locale), uiText("photoguide.avoidPhotosWhereTheWheelsAreHiddenByA", locale)],
      ["03", uiText("photo.sharp.title", locale), uiText("photo.sharp.copy", locale)],
      ["04", uiText("photoguide.doNotEditThePhotoBeforeUploading", locale), uiText("photoguide.heavyFiltersArtificialBlurAndDistortedPerspectiveMakeIt", locale)],
    ],
  });
}
