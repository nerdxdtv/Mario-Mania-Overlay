"use strict";

/*
 * Mario Mania Marathon 2027
 * Break Screen Overlay
 *
 * This file manages:
 * - Prize and schedule cards in one mixed feature rotation
 * - Trivia GIF crossfades
 */

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("break-screen-loaded");

  startFeatureRotation();
  startTriviaRotation();
});

/*
 * ------------------------------------------------------------
 * SHARED HELPERS
 * ------------------------------------------------------------
 */

function positiveNumberOrFallback(value, fallback) {
  return Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function nonNegativeIntegerOrFallback(value, fallback) {
  return Number.isInteger(value) && value >= 0
    ? value
    : fallback;
}

function validString(value, fallback = "") {
  return typeof value === "string" && value.trim()
    ? value.trim()
    : fallback;
}

async function fetchJson(url) {
  const separator = url.includes("?") ? "&" : "?";

  const response = await fetch(
    `${url}${separator}v=${Date.now()}`,
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `Unable to load ${url} (${response.status}).`,
    );
  }

  return response.json();
}

/*
 * ------------------------------------------------------------
 * PRIZE / SCHEDULE FEATURE ROTATION
 * ------------------------------------------------------------
 */

const PRIZE_DATA_URL = "../data/prizes.json";
const SCHEDULE_DATA_URL = "../data/schedule-2027.json";
const SCHEDULE_SETTINGS_URL =
  "../data/schedule-settings-2027.json";

const DEFAULT_FEATURE_DISPLAY_MS = 12_000;
const DEFAULT_FEATURE_FADE_MS = 1_200;
const DEFAULT_SCHEDULE_DISPLAY_MS = 15_000;
const DEFAULT_SCHEDULE_EVERY = 2;
const DEFAULT_SCHEDULE_REFRESH_MS = 15_000;
const DEFAULT_SLOT_MINUTES = 120;
const FEATURE_RETRY_DELAY_MS = 5_000;

let featureRotationTimer = null;
let featureCleanupTimer = null;
let scheduleRefreshTimer = null;
let scheduleSnapshot = null;
let scheduleRefreshMilliseconds =
  DEFAULT_SCHEDULE_REFRESH_MS;
let hasStartedScheduleRefresh = false;

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
      "Feature rotation could not start because its elements are missing.",
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

  const prizeSlides = config.slides
    .map((slide, index) => {
      try {
        return normalizePrizeSlide(slide, index);
      } catch (error) {
        console.error(error);
        return null;
      }
    })
    .filter(Boolean);

  if (prizeSlides.length === 0) {
    console.warn(
      "Feature rotation could not start because prizes.json has no valid slides.",
    );
    return;
  }

  const prizeDisplayMs = positiveNumberOrFallback(
    Number(config.displaySeconds) * 1_000,
    DEFAULT_FEATURE_DISPLAY_MS,
  );

  const fadeMs = positiveNumberOrFallback(
    Number(config.fadeMilliseconds),
    DEFAULT_FEATURE_FADE_MS,
  );

  const scheduleEnabled =
    config.scheduleEnabled !== false;

  const scheduleEvery = Math.max(
    1,
    nonNegativeIntegerOrFallback(
      Number(config.scheduleEvery),
      DEFAULT_SCHEDULE_EVERY,
    ),
  );

  const scheduleDisplayMs = positiveNumberOrFallback(
    Number(config.scheduleDisplaySeconds) * 1_000,
    DEFAULT_SCHEDULE_DISPLAY_MS,
  );

  panel.style.setProperty(
    "--feature-fade-duration",
    `${fadeMs}ms`,
  );

  if (!hasStartedScheduleRefresh) {
    hasStartedScheduleRefresh = true;
    await refreshScheduleSnapshot();
  }

  const slideElements = [slideA, slideB];

  let visibleElementIndex = 0;
  let nextPrizeIndex = 0;
  let prizesSinceSchedule = 0;

  function getNextDescriptor() {
    if (
      scheduleEnabled &&
      scheduleSnapshot &&
      prizesSinceSchedule >= scheduleEvery
    ) {
      prizesSinceSchedule = 0;

      return {
        type: "schedule",
        durationMs: scheduleDisplayMs,
      };
    }

    const slide = prizeSlides[nextPrizeIndex];

    nextPrizeIndex =
      (nextPrizeIndex + 1) % prizeSlides.length;

    prizesSinceSchedule += 1;

    return {
      type: "prize",
      slide,
      durationMs: prizeDisplayMs,
    };
  }

  async function buildDescriptorContent(descriptor) {
    if (descriptor.type === "schedule") {
      return createScheduleCard(scheduleSnapshot);
    }

    return createPreloadedPrizeImage(
      descriptor.slide,
    );
  }

  async function showDescriptor(
    descriptor,
    isFirstSlide = false,
  ) {
    const nextElementIndex = isFirstSlide
      ? visibleElementIndex
      : visibleElementIndex === 0
        ? 1
        : 0;

    const nextElement =
      slideElements[nextElementIndex];

    const currentElement =
      slideElements[visibleElementIndex];

    let content;

    try {
      content = await buildDescriptorContent(
        descriptor,
      );
    } catch (error) {
      console.error(error);

      featureRotationTimer = window.setTimeout(
        showNextFeature,
        FEATURE_RETRY_DELAY_MS,
      );

      return false;
    }

    nextElement.replaceChildren(content);

    if (isFirstSlide) {
      nextElement.classList.add("is-visible");
      visibleElementIndex = nextElementIndex;
      return true;
    }

    nextElement.classList.add("is-visible");
    currentElement.classList.remove("is-visible");

    featureCleanupTimer = window.setTimeout(() => {
      currentElement.replaceChildren();
    }, fadeMs);

    visibleElementIndex = nextElementIndex;

    return true;
  }

  async function showNextFeature() {
    const descriptor = getNextDescriptor();

    const didShow = await showDescriptor(descriptor);

    if (!didShow) {
      return;
    }

    featureRotationTimer = window.setTimeout(
      showNextFeature,
      descriptor.durationMs,
    );
  }

  const firstDescriptor = getNextDescriptor();

  const didShowFirst = await showDescriptor(
    firstDescriptor,
    true,
  );

  if (!didShowFirst) {
    return;
  }

  featureRotationTimer = window.setTimeout(
    showNextFeature,
    firstDescriptor.durationMs,
  );
}

async function loadPrizeConfig() {
  const data = await fetchJson(PRIZE_DATA_URL);

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

/*
 * ------------------------------------------------------------
 * BREAK-SCREEN SCHEDULE DATA
 * ------------------------------------------------------------
 */

const fallbackScheduleSettings = {
  defaultSlotMinutes: DEFAULT_SLOT_MINUTES,
  scheduleRefreshInterval:
    DEFAULT_SCHEDULE_REFRESH_MS,
  testMode: {
    enabled: false,
    state: "live",
    startIndex: 0,
  },
};

async function refreshScheduleSnapshot() {
  try {
    const [
      scheduleDocument,
      scheduleSettingsDocument,
    ] = await Promise.all([
      fetchJson(SCHEDULE_DATA_URL),
      fetchJson(SCHEDULE_SETTINGS_URL),
    ]);

    const settings = normalizeScheduleSettings(
      scheduleSettingsDocument,
    );

    const entries = normalizeSchedule(
      scheduleDocument,
      settings,
    );

    const selection = selectScheduleEntries(
      entries,
      settings,
    );

    scheduleSnapshot = {
      selection,
      timeZone: validString(
        scheduleDocument.timeZone,
        "America/New_York",
      ),
    };

    scheduleRefreshMilliseconds =
      settings.scheduleRefreshInterval;
  } catch (error) {
    console.error(
      "Unable to refresh the break-screen schedule.",
      error,
    );
  } finally {
    scheduleRefreshTimer = window.setTimeout(
      refreshScheduleSnapshot,
      scheduleRefreshMilliseconds,
    );
  }
}

function normalizeScheduleSettings(document) {
  const source =
    document &&
    typeof document === "object" &&
    !Array.isArray(document)
      ? document
      : {};

  const testModeSource =
    source.testMode &&
    typeof source.testMode === "object" &&
    !Array.isArray(source.testMode)
      ? source.testMode
      : {};

  const requestedState = validString(
    testModeSource.state,
    fallbackScheduleSettings.testMode.state,
  ).toLowerCase();

  const testState = [
    "before",
    "live",
    "after",
  ].includes(requestedState)
    ? requestedState
    : fallbackScheduleSettings.testMode.state;

  return {
    defaultSlotMinutes:
      positiveNumberOrFallback(
        Number(source.defaultSlotMinutes),
        fallbackScheduleSettings.defaultSlotMinutes,
      ),
    scheduleRefreshInterval:
      positiveNumberOrFallback(
        Number(source.scheduleRefreshInterval),
        fallbackScheduleSettings
          .scheduleRefreshInterval,
      ),
    testMode: {
      enabled: testModeSource.enabled === true,
      state: testState,
      startIndex:
        nonNegativeIntegerOrFallback(
          Number(testModeSource.startIndex),
          fallbackScheduleSettings
            .testMode
            .startIndex,
        ),
    },
  };
}

function getScheduleEntries(scheduleDocument) {
  if (Array.isArray(scheduleDocument)) {
    return scheduleDocument;
  }

  if (
    scheduleDocument &&
    typeof scheduleDocument === "object" &&
    Array.isArray(scheduleDocument.entries)
  ) {
    return scheduleDocument.entries;
  }

  return [];
}

function normalizeSchedule(
  scheduleDocument,
  settings,
) {
  return getScheduleEntries(scheduleDocument)
    .map((entry, index) => {
      if (
        !entry ||
        typeof entry !== "object" ||
        Array.isArray(entry)
      ) {
        return null;
      }

      const startUtc = validString(
        entry.startUtc,
        "",
      );

      const startTime = Date.parse(startUtc);

      if (
        !startUtc ||
        !Number.isFinite(startTime)
      ) {
        return null;
      }

      let endTime = Number.NaN;

      const endUtc = validString(
        entry.endUtc,
        "",
      );

      if (endUtc) {
        endTime = Date.parse(endUtc);
      }

      if (!Number.isFinite(endTime)) {
        const durationMinutes =
          positiveNumberOrFallback(
            Number(entry.durationMinutes),
            settings.defaultSlotMinutes,
          );

        endTime =
          startTime +
          durationMinutes * 60 * 1_000;
      }

      if (endTime <= startTime) {
        return null;
      }

      return {
        id: validString(
          entry.id,
          `schedule-${index}-${startTime}`,
        ),
        startTime,
        endTime,
        gameTitle: validString(
          entry.gameTitle,
          "GAME TBA",
        ),
        streamerName: validString(
          entry.streamerName,
          "TBA",
        ),
      };
    })
    .filter(Boolean)
    .sort((first, second) => {
      return first.startTime - second.startTime;
    });
}

function makeScheduleSelection(
  state,
  entries,
  startIndex,
  isFinalBlock = false,
) {
  return {
    state,
    isFinalBlock,
    now: entries[startIndex] || null,
    next: entries[startIndex + 1] || null,
    after: entries[startIndex + 2] || null,
    later: entries[startIndex + 3] || null,
  };
}

function selectScheduleEntries(entries, settings) {
  if (entries.length === 0) {
    return {
      state: "empty",
      isFinalBlock: false,
      now: null,
      next: null,
      after: null,
      later: null,
    };
  }

  if (settings.testMode.enabled) {
    return selectTestScheduleEntries(
      entries,
      settings.testMode,
    );
  }

  const currentTime = Date.now();
  const firstEntry = entries[0];
  const lastEntry = entries[entries.length - 1];

  if (currentTime < firstEntry.startTime) {
    return {
      state: "before",
      isFinalBlock: false,
      now: null,
      next: entries[0] || null,
      after: entries[1] || null,
      later: entries[2] || null,
    };
  }

  const currentIndex = entries.findIndex(
    (entry) => {
      return (
        currentTime >= entry.startTime &&
        currentTime < entry.endTime
      );
    },
  );

  if (currentIndex >= 0) {
    return makeScheduleSelection(
      "live",
      entries,
      currentIndex,
      currentIndex === entries.length - 1,
    );
  }

  const upcomingIndex = entries.findIndex(
    (entry) => entry.startTime > currentTime,
  );

  if (upcomingIndex >= 0) {
    return {
      state: "between",
      isFinalBlock: false,
      now: null,
      next: entries[upcomingIndex] || null,
      after:
        entries[upcomingIndex + 1] || null,
      later:
        entries[upcomingIndex + 2] || null,
    };
  }

  if (currentTime >= lastEntry.endTime) {
    return {
      state: "after",
      isFinalBlock: false,
      now: null,
      next: null,
      after: null,
      later: null,
    };
  }

  return {
    state: "empty",
    isFinalBlock: false,
    now: null,
    next: null,
    after: null,
    later: null,
  };
}

function selectTestScheduleEntries(
  entries,
  testMode,
) {
  if (testMode.state === "before") {
    return {
      state: "before",
      isFinalBlock: false,
      now: null,
      next: entries[0] || null,
      after: entries[1] || null,
      later: entries[2] || null,
    };
  }

  if (testMode.state === "after") {
    return {
      state: "after",
      isFinalBlock: false,
      now: null,
      next: null,
      after: null,
      later: null,
    };
  }

  const startIndex = Math.min(
    testMode.startIndex,
    Math.max(entries.length - 1, 0),
  );

  return makeScheduleSelection(
    "live",
    entries,
    startIndex,
    startIndex === entries.length - 1,
  );
}

/*
 * ------------------------------------------------------------
 * SCHEDULE CARD CREATION
 * ------------------------------------------------------------
 */

function createScheduleCard(snapshot) {
  if (!snapshot || !snapshot.selection) {
    return createScheduleMessage(
      "SCHEDULE COMING SOON",
      "Mario Mania Marathon 2027",
    );
  }

  const { selection, timeZone } = snapshot;

  if (selection.state === "empty") {
    return createScheduleMessage(
      "SCHEDULE COMING SOON",
      "Check back for Mario Mania Marathon 2027 updates.",
    );
  }

  if (selection.state === "after") {
    return createScheduleMessage(
      "EVENT COMPLETE",
      "Thank you for supporting March of Dimes!",
    );
  }

  const card = document.createElement("article");
  card.className = "feature-schedule-card";

  const header = document.createElement("header");
  header.className = "feature-schedule-header";

  const heading = document.createElement("div");
  heading.className = "feature-schedule-heading";

  const subheading = document.createElement("div");
  subheading.className =
    "feature-schedule-subheading";
  subheading.textContent =
    "MARIO MANIA MARATHON 2027";

  const rows = document.createElement("div");
  rows.className = "feature-schedule-rows";

  let rowDefinitions;

  if (selection.state === "live") {
    heading.textContent = "LIVE SCHEDULE";

    rowDefinitions = [
      {
        label: "LIVE NOW",
        entry: selection.now,
        isLive: true,
      },
      {
        label: "UP NEXT",
        entry: selection.next,
      },
      {
        label: "AFTER THAT",
        entry: selection.after,
      },
    ];
  } else if (selection.state === "before") {
    heading.textContent = "EVENT STARTS SOON";

    rowDefinitions = [
      {
        label: "FIRST UP",
        entry: selection.next,
      },
      {
        label: "AFTER THAT",
        entry: selection.after,
      },
      {
        label: "LATER",
        entry: selection.later,
      },
    ];
  } else {
    heading.textContent = "COMING UP";

    rowDefinitions = [
      {
        label: "UP NEXT",
        entry: selection.next,
      },
      {
        label: "AFTER THAT",
        entry: selection.after,
      },
      {
        label: "LATER",
        entry: selection.later,
      },
    ];
  }

  header.append(heading, subheading);

  rowDefinitions.forEach((definition) => {
    rows.appendChild(
      createScheduleRow(
        definition.label,
        definition.entry,
        timeZone,
        definition.isLive === true,
      ),
    );
  });

  card.append(header, rows);

  return card;
}

function createScheduleRow(
  label,
  entry,
  timeZone,
  isLive,
) {
  const row = document.createElement("div");
  row.className = "feature-schedule-row";

  if (isLive) {
    row.classList.add("is-live");
  }

  const meta = document.createElement("div");
  meta.className = "feature-schedule-meta";

  const labelElement =
    document.createElement("div");
  labelElement.className =
    "feature-schedule-label";
  labelElement.textContent = label;

  const timeElement =
    document.createElement("div");
  timeElement.className =
    "feature-schedule-time";

  const gameElement =
    document.createElement("div");
  gameElement.className =
    "feature-schedule-game";

  const streamerElement =
    document.createElement("div");
  streamerElement.className =
    "feature-schedule-streamer";

  if (entry) {
    timeElement.textContent =
      formatScheduleTime(
        entry.startTime,
        timeZone,
      );

    gameElement.textContent =
      entry.gameTitle;

    streamerElement.textContent =
      `with ${entry.streamerName}`;
  } else {
    timeElement.textContent = "TIME TBA";
    gameElement.textContent =
      "SCHEDULE COMING SOON";
    streamerElement.textContent =
      "Mario Mania Marathon 2027";
  }

  meta.append(labelElement, timeElement);

  row.append(
    meta,
    gameElement,
    streamerElement,
  );

  return row;
}

function formatScheduleTime(
  timestamp,
  timeZone,
) {
  try {
    return new Intl.DateTimeFormat(
      "en-US",
      {
        hour: "numeric",
        minute: "2-digit",
        timeZone,
        timeZoneName: "short",
      },
    ).format(new Date(timestamp));
  } catch (error) {
    console.error(
      "Unable to format schedule time.",
      error,
    );

    return "TIME TBA";
  }
}

function createScheduleMessage(title, copy) {
  const message =
    document.createElement("article");
  message.className =
    "feature-schedule-message";

  const titleElement =
    document.createElement("div");
  titleElement.className =
    "feature-schedule-message-title";
  titleElement.textContent = title;

  const copyElement =
    document.createElement("div");
  copyElement.className =
    "feature-schedule-message-copy";
  copyElement.textContent = copy;

  message.append(titleElement, copyElement);

  return message;
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
    } while (
      nextIndex === currentTriviaIndex
    );

    return nextIndex;
  }

  function buildRestartableUrl(path) {
    playCounter += 1;

    const separator =
      path.includes("?") ? "&" : "?";

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
    const nextTriviaIndex =
      chooseNextTriviaIndex();

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

      triviaRotationTimer =
        window.setTimeout(
          showNextTrivia,
          TRIVIA_RETRY_DELAY_MS,
        );

      return;
    }

    nextElement.src = nextUrl;
    nextElement.classList.add("is-visible");
    currentElement.classList.remove(
      "is-visible",
    );

    triviaCleanupTimer =
      window.setTimeout(() => {
        currentElement.removeAttribute("src");
      }, TRIVIA_FADE_MS);

    visibleElementIndex = nextElementIndex;
    currentTriviaIndex = nextTriviaIndex;

    scheduleNextTrivia();
  }

  async function showFirstTrivia() {
    currentTriviaIndex =
      chooseNextTriviaIndex();

    const firstUrl = buildRestartableUrl(
      triviaSlides[currentTriviaIndex],
    );

    try {
      await preloadTriviaImage(firstUrl);
    } catch (error) {
      console.error(error);

      triviaRotationTimer =
        window.setTimeout(
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

  if (scheduleRefreshTimer !== null) {
    window.clearTimeout(scheduleRefreshTimer);
  }

  if (triviaRotationTimer !== null) {
    window.clearTimeout(triviaRotationTimer);
  }

  if (triviaCleanupTimer !== null) {
    window.clearTimeout(triviaCleanupTimer);
  }
});
