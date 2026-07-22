"use strict";

/*
 * Mario Mania Marathon 2027
 * Break Screen Overlay
 *
 * Trivia GIF rotation:
 * - Displays one GIF at a time.
 * - Crossfades between two overlapping image elements.
 * - Avoids immediate repeats.
 * - Restarts each GIF whenever it returns.
 */

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("break-screen-loaded");

  const triviaSlides = [
    "../assets/break/trivia/trivia-01.gif",
    "../assets/break/trivia/trivia-02.gif",
  ];

  /*
   * The source timeline is 60 fps.
   * 00:00:25:24 = 25 seconds + 24/60 second = 25.4 seconds.
   */
  const TRIVIA_DISPLAY_MS = 25_400;
  const TRIVIA_FADE_MS = 1_200;
  const RETRY_DELAY_MS = 5_000;

  const slideA = document.getElementById("trivia-slide-a");
  const slideB = document.getElementById("trivia-slide-b");

  if (!slideA || !slideB || triviaSlides.length === 0) {
    console.warn("Trivia rotation could not start.");
    return;
  }

  const slideElements = [slideA, slideB];

  let visibleElementIndex = 0;
  let currentTriviaIndex = -1;
  let playCounter = 0;
  let rotationTimer = null;
  let cleanupTimer = null;

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

  function preloadImage(url) {
    return new Promise((resolve, reject) => {
      const image = new Image();

      image.onload = () => resolve(url);

      image.onerror = () => {
        reject(
          new Error(`Unable to load trivia GIF: ${url}`),
        );
      };

      image.src = url;
    });
  }

  function scheduleNextTrivia() {
    rotationTimer = window.setTimeout(
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
      await preloadImage(nextUrl);
    } catch (error) {
      console.error(error);

      rotationTimer = window.setTimeout(
        showNextTrivia,
        RETRY_DELAY_MS,
      );

      return;
    }

    nextElement.src = nextUrl;
    nextElement.classList.add("is-visible");
    currentElement.classList.remove("is-visible");

    cleanupTimer = window.setTimeout(() => {
      currentElement.removeAttribute("src");
    }, TRIVIA_FADE_MS);

    visibleElementIndex = nextElementIndex;
    currentTriviaIndex = nextTriviaIndex;

    scheduleNextTrivia();
  }

  async function startTriviaRotation() {
    currentTriviaIndex = chooseNextTriviaIndex();

    const firstUrl = buildRestartableUrl(
      triviaSlides[currentTriviaIndex],
    );

    try {
      await preloadImage(firstUrl);
    } catch (error) {
      console.error(error);

      rotationTimer = window.setTimeout(
        startTriviaRotation,
        RETRY_DELAY_MS,
      );

      return;
    }

    slideA.src = firstUrl;
    slideA.classList.add("is-visible");
    slideB.classList.remove("is-visible");

    visibleElementIndex = 0;

    scheduleNextTrivia();
  }

  window.addEventListener("beforeunload", () => {
    if (rotationTimer !== null) {
      window.clearTimeout(rotationTimer);
    }

    if (cleanupTimer !== null) {
      window.clearTimeout(cleanupTimer);
    }
  });

  startTriviaRotation();
});
