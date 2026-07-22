"use strict";

/*
 * Mario Mania Marathon 2027
 * Break Screen Overlay
 *
 * This file manages:
 * - Prize/feature-panel crossfades from data/prizes.json
 * - Trivia GIF crossfades
 *
 * The feature panel uses generic layers so schedule cards can later
 * rotate through the same space alongside prize images.
 */

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("break-screen-loaded");

  startFeatureRotation();
  startTriviaRotation();
});

/*
 * ------------------------------------------------------------
 * PRIZE / FEATURE ROTATION
 * ------------------------------------------------------------
 */

const PRIZE_DATA_URL = "../data/prizes.json";
const DEFAULT_FEATURE_DISPLAY_MS = 12_000;
const DEFAULT_FEATURE_FADE_MS = 1_200;
const FEATURE_RETRY_DELAY_MS = 5_000;

let featureRotationTimer = null;
let featureCleanupTimer = null;

async function startFeatureRotation() {
  const panel = document.getElementById(
    "break-feature-panel",
  );

  const slideA = document.getElementById(
    "feature-slide-a",
  );

  const slideB = document.getElementById(
    "feature-slide-b",
  );

  if (!panel || !slideA || !slideB) {
    console.warn(
      "Prize rotation could not start because its elements are missing.",
    );
    return;
  }

  let config;

  try {
    config = await loadPrizeConfig();
  } catch (error) {
    console.error(error);

    featureRotationTimer = window.setTimeout(
      startFeatureRotation,
      FEATURE_RETRY_DELAY_MS,
    );

    return;
  }

  const slides = config.slides;

  if (slides.length === 0) {
    console.warn(
      "Prize rotation could not start because prizes.json has no slides.",
    );
    return;
  }

  const displayMs = positiveNumberOrFallback(
    Number(config.displaySeconds) * 1_000,
    DEFAULT_FEATURE_DISPLAY_MS,
  );

  const fadeMs = positiveNumberOrFallback(
    Number(config.fadeMilliseconds),
    DEFAULT_FEATURE_FADE_MS,
  );

  panel.style.setProperty(
    "--feature-fade-duration",
    `${fadeMs}ms`,
  );

  const slideElements = [slideA, slideB];

  let visibleElementIndex = 0;
  let currentSlideIndex = 0;

  try {
    const firstSlide = normalizePrizeSlide(
      slides[currentSlideIndex],
      currentSlideIndex,
    );

    const firstImage = await createPreloadedPrizeImage(
      firstSlide,
    );

    slideA.replaceChildren(firstImage);
    slideA.classList.add("is-visible");
    slideB.classList.remove("is-visible");
  } catch (error) {
    console.error(error);

    featureRotationTimer = window.setTimeout(
      startFeatureRotation,
      FEATURE_RETRY_DELAY_MS,
    );

    return;
  }

  if (slides.length === 1) {
    return;
  }

  async function showNextFeature() {
    const nextSlideIndex =
      (currentSlideIndex + 1) % slides.length;

    const nextElementIndex =
      visibleElementIndex === 0 ? 1 : 0;

    const currentElement =
      slideElements[visibleElementIndex];

    const nextElement =
      slideElements[nextElementIndex];

    let nextImage;

    try {
      const nextSlide = normalizePrizeSlide(
        slides[nextSlideIndex],
        nextSlideIndex,
      );

      nextImage = await createPreloadedPrizeImage(
        nextSlide,
      );
    } catch (error) {
      console.error(error);

      featureRotationTimer = window.setTimeout(
        showNextFeature,
        FEATURE_RETRY_DELAY_MS,
      );

      return;
    }

    nextElement.replaceChildren(nextImage);
    nextElement.classList.add("is-visible");
    currentElement.classList.remove("is-visible");

    featureCleanupTimer = window.setTimeout(() => {
      currentElement.replaceChildren();
    }, fadeMs);

    visibleElementIndex = nextElementIndex;
    currentSlideIndex = nextSlideIndex;

    featureRotationTimer = window.setTimeout(
      showNextFeature,
      displayMs,
    );
  }

  featureRotationTimer = window.setTimeout(
    showNextFeature,
    displayMs,
  );
}

async function loadPrizeConfig() {
  const response = await fetch(
    `${PRIZE_DATA_URL}?v=${Date.now()}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Unable to load prizes.json (${response.status}).`,
    );
  }

  const data = await response.json();

  if (!data || !Array.isArray(data.slides)) {
    throw new Error(
      "prizes.json must contain a slides array.",
    );
  }

  return data;
}

function normalizePrizeSlide(slide, index) {
  if (
    !slide ||
    typeof slide.src !== "string" ||
    slide.src.trim() === ""
  ) {
    throw new Error(
      `Prize slide ${index + 1} does not have a valid src.`,
    );
  }

  return {
    src: slide.src.trim(),
    alt:
      typeof slide.alt === "string" &&
      slide.alt.trim() !== ""
        ? slide.alt.trim()
        : `Mario Mania featured prize ${index + 1}`,
  };
}

function createPreloadedPrizeImage(slide) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.className = "feature-prize-image";
    image.alt = slide.alt;
    image.decoding = "async";

    image.onload = () => resolve(image);

    image.onerror = () => {
      reject(
        new Error(
          `Unable to load prize image: ${slide.src}`,
        ),
      );
    };

    image.src = slide.src;
  });
}

function positiveNumberOrFallback(value, fallback) {
  return Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

/*
 * ------------------------------------------------------------
 * TRIVIA GIF ROTATION
 * ------------------------------------------------------------
 */

const triviaSlides = [
  "../assets/break/trivia/trivia-01.gif",
  "../assets/break/trivia/trivia-02.gif",
  "../assets/break/trivia/trivia-03.gif",
  "../assets/break/trivia/trivia-04.gif",
  "../assets/break/trivia/trivia-05.gif",
  "../assets/break/trivia/trivia-06.gif",
  "../assets/break/trivia/trivia-07.gif",
  "../assets/break/trivia/trivia-08.gif",
  "../assets/break/trivia/trivia-09.gif",
  "../assets/break/trivia/trivia-10.gif",
];

/*
 * The source timeline is 60 fps.
 * 00:00:25:24 = 25 seconds + 24/60 second = 25.4 seconds.
 */
const TRIVIA_DISPLAY_MS = 25_400;
const TRIVIA_FADE_MS = 1_200;
const TRIVIA_RETRY_DELAY_MS = 5_000;

let triviaRotationTimer = null;
let triviaCleanupTimer = null;

function startTriviaRotation() {
  const slideA = document.getElementById(
    "trivia-slide-a",
  );

  const slideB = document.getElementById(
    "trivia-slide-b",
  );

  if (
    !slideA ||
    !slideB ||
    triviaSlides.length === 0
  ) {
    console.warn("Trivia rotation could not start.");
    return;
  }

  const slideElements = [slideA, slideB];

  let visibleElementIndex = 0;
  let currentTriviaIndex = -1;
  let playCounter = 0;

  function chooseNextTriviaIndex() {
    if (triviaSlides.length === 1) {
      return 0;
    }

    let nextIndex;

    do {
      nextIndex = Math.floor(
        Math.random() * triviaSlides.length,
      );
    } while (nextIndex === currentTriviaIndex);

    return nextIndex;
  }

  function buildRestartableUrl(path) {
    playCounter += 1;

    const separator = path.includes("?") ? "&" : "?";

    return (
      `${path}${separator}` +
      `play=${Date.now()}-${playCounter}`
    );
  }

  function preloadTriviaImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(url);

      image.onerror = () => {
        reject(
          new Error(
            `Unable to load trivia GIF: ${url}`,
          ),
        );
      };

      image.src = url;
    });
  }

  function scheduleNextTrivia() {
    triviaRotationTimer = window.setTimeout(
      showNextTrivia,
      TRIVIA_DISPLAY_MS,
    );
  }

  async function showNextTrivia() {
    const nextTriviaIndex = chooseNextTriviaIndex();

    const nextElementIndex =
      visibleElementIndex === 0 ? 1 : 0;

    const currentElement =
      slideElements[visibleElementIndex];

    const nextElement =
      slideElements[nextElementIndex];

    const nextUrl = buildRestartableUrl(
      triviaSlides[nextTriviaIndex],
    );

    try {
      await preloadTriviaImage(nextUrl);
    } catch (error) {
      console.error(error);

      triviaRotationTimer = window.setTimeout(
        showNextTrivia,
        TRIVIA_RETRY_DELAY_MS,
      );

      return;
    }

    nextElement.src = nextUrl;
    nextElement.classList.add("is-visible");
    currentElement.classList.remove("is-visible");

    triviaCleanupTimer = window.setTimeout(() => {
      currentElement.removeAttribute("src");
    }, TRIVIA_FADE_MS);

    visibleElementIndex = nextElementIndex;
    currentTriviaIndex = nextTriviaIndex;

    scheduleNextTrivia();
  }

  async function showFirstTrivia() {
    currentTriviaIndex = chooseNextTriviaIndex();

    const firstUrl = buildRestartableUrl(
      triviaSlides[currentTriviaIndex],
    );

    try {
      await preloadTriviaImage(firstUrl);
    } catch (error) {
      console.error(error);

      triviaRotationTimer = window.setTimeout(
        showFirstTrivia,
        TRIVIA_RETRY_DELAY_MS,
      );

      return;
    }

    slideA.src = firstUrl;
    slideA.classList.add("is-visible");
    slideB.classList.remove("is-visible");

    visibleElementIndex = 0;

    scheduleNextTrivia();
  }

  showFirstTrivia();
}

window.addEventListener("beforeunload", () => {
  if (featureRotationTimer !== null) {
    window.clearTimeout(featureRotationTimer);
  }

  if (featureCleanupTimer !== null) {
    window.clearTimeout(featureCleanupTimer);
  }

  if (triviaRotationTimer !== null) {
    window.clearTimeout(triviaRotationTimer);
  }

  if (triviaCleanupTimer !== null) {
    window.clearTimeout(triviaCleanupTimer);
  }
});
