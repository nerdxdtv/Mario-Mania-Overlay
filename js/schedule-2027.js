/*
 * Mario Mania Marathon 2027
 * Animated schedule and informational message bar
 */

(function () {
  "use strict";

  /*
   * ------------------------------------------------------------
   * LOCAL DATA FILES
   * ------------------------------------------------------------
   */

  const SCHEDULE_URL = "../data/schedule-2027.json";
  const SETTINGS_URL = "../data/schedule-settings-2027.json";
  const MESSAGES_URL = "../data/messages.json";

  const scheduleLine = document.getElementById("schedule-line");

  if (!scheduleLine) {
    return;
  }

  /*
   * These fallbacks keep the overlay functional if a JSON file is
   * temporarily unavailable. Normal adjustments should be made in
   * data/schedule-settings.json, not here.
   */
  const fallbackScheduleSettings = {
    defaultSlotMinutes: 120,
    scheduleRefreshInterval: 15000,
    messagesRefreshInterval: 60000,
    testMode: {
      enabled: false,
      state: "live",
      startIndex: 0
    },
    timing: {
      initialViewDuration: 5000,
      nowFadeDuration: 450,
      slideDelayAfterNowFade: 250,
      slideDuration: 900,
      laterRevealDelay: 550,
      laterViewDuration: 5000,
      scheduleFadeDuration: 500
    },
    stateText: {
      beforeEventNow: "EVENT STARTS SOON",
      betweenBlocksNow: "UP NEXT SOON",
      emptyNow: "SCHEDULE COMING SOON",
      emptyNext: "CHECK BACK FOR UPDATES",
      emptyAfter: "MARIO MANIA 2027",
      emptyLater: "MARIOMANIAMARATHON.COM",
      finalBlockNext: "EVENT FINALE",
      finalBlockAfter: "THANK YOU FOR WATCHING",
      finalBlockLater: "DONATE AT MARIOMANIAMARATHON.COM",
      afterEventNow: "EVENT COMPLETE",
      afterEventNext: "THANK YOU FOR WATCHING",
      afterEventAfter: "DONATE AT MARIOMANIAMARATHON.COM",
      afterEventLater: "SEE YOU NEXT YEAR",
      noUpcoming: "NO UPCOMING SLOT",
      noFollowing: "NO FOLLOWING SLOT",
      noLater: "NO LATER SLOT"
    }
  };

  const fallbackMessageSettings = {
    defaultDuration: 5000,
    transitionDuration: 500,
    messages: [
      {
        text: "Mario Mania benefits March of Dimes!"
      },
      {
        text: "...but only because of YOU!"
      },
      {
        text: "$5 can support newborn screenings through March of Dimes Advocacy.",
        duration: 6500
      },
      {
        text: "Donate at MarioManiaMarathon.com"
      }
    ]
  };

  let scheduleSettings = cloneObject(fallbackScheduleSettings);
  let messageSettings = {
    ...fallbackMessageSettings,
    messages: [...fallbackMessageSettings.messages]
  };

  let lastScheduleSignature = "";
  let hasLoadedSchedule = false;
  let animationVersion = 0;

  /*
   * ------------------------------------------------------------
   * GENERAL HELPERS
   * ------------------------------------------------------------
   */

  function cloneObject(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function wait(milliseconds) {
    return new Promise((resolve) => {
      window.setTimeout(resolve, milliseconds);
    });
  }

  function nextFrame() {
    return new Promise((resolve) => {
      window.requestAnimationFrame(resolve);
    });
  }

  function isPlainObject(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function positiveNumber(value, fallbackValue) {
    const number = Number(value);

    return Number.isFinite(number) && number > 0
      ? number
      : fallbackValue;
  }

  function nonNegativeInteger(value, fallbackValue) {
    const number = Number(value);

    return Number.isInteger(number) && number >= 0
      ? number
      : fallbackValue;
  }

  function validString(value, fallbackValue) {
    return typeof value === "string" && value.trim()
      ? value.trim()
      : fallbackValue;
  }

  function fetchJson(url) {
    const separator = url.includes("?") ? "&" : "?";

    return fetch(`${url}${separator}t=${Date.now()}`, {
      cache: "no-store"
    }).then((response) => {
      if (!response.ok) {
        throw new Error(
          `Request for ${url} returned status ${response.status}.`
        );
      }

      return response.json();
    });
  }

  async function brieflyWaitForFonts() {
    if (!document.fonts || !document.fonts.ready) {
      await wait(100);
      return;
    }

    await Promise.race([
      document.fonts.ready.catch(() => {}),
      wait(1200)
    ]);
  }

  /*
   * ------------------------------------------------------------
   * SCHEDULE SETTINGS
   * ------------------------------------------------------------
   */

  function normalizeScheduleSettings(configuration) {
    const fallback = fallbackScheduleSettings;
    const source = isPlainObject(configuration)
      ? configuration
      : {};
    const testModeSource = isPlainObject(source.testMode)
      ? source.testMode
      : {};
    const timingSource = isPlainObject(source.timing)
      ? source.timing
      : {};
    const textSource = isPlainObject(source.stateText)
      ? source.stateText
      : {};

    const requestedTestState = validString(
      testModeSource.state,
      fallback.testMode.state
    ).toLowerCase();

    const testState = ["before", "live", "after"].includes(
      requestedTestState
    )
      ? requestedTestState
      : fallback.testMode.state;

    return {
      defaultSlotMinutes: positiveNumber(
        source.defaultSlotMinutes,
        fallback.defaultSlotMinutes
      ),
      scheduleRefreshInterval: positiveNumber(
        source.scheduleRefreshInterval,
        fallback.scheduleRefreshInterval
      ),
      messagesRefreshInterval: positiveNumber(
        source.messagesRefreshInterval,
        fallback.messagesRefreshInterval
      ),
      testMode: {
        enabled: testModeSource.enabled === true,
        state: testState,
        startIndex: nonNegativeInteger(
          testModeSource.startIndex,
          fallback.testMode.startIndex
        )
      },
      timing: {
        initialViewDuration: positiveNumber(
          timingSource.initialViewDuration,
          fallback.timing.initialViewDuration
        ),
        nowFadeDuration: positiveNumber(
          timingSource.nowFadeDuration,
          fallback.timing.nowFadeDuration
        ),
        slideDelayAfterNowFade: positiveNumber(
          timingSource.slideDelayAfterNowFade,
          fallback.timing.slideDelayAfterNowFade
        ),
        slideDuration: positiveNumber(
          timingSource.slideDuration,
          fallback.timing.slideDuration
        ),
        laterRevealDelay: positiveNumber(
          timingSource.laterRevealDelay,
          fallback.timing.laterRevealDelay
        ),
        laterViewDuration: positiveNumber(
          timingSource.laterViewDuration,
          fallback.timing.laterViewDuration
        ),
        scheduleFadeDuration: positiveNumber(
          timingSource.scheduleFadeDuration,
          fallback.timing.scheduleFadeDuration
        )
      },
      stateText: Object.fromEntries(
        Object.entries(fallback.stateText).map(([key, fallbackValue]) => {
          return [
            key,
            validString(textSource[key], fallbackValue)
          ];
        })
      )
    };
  }

  async function loadScheduleSettings() {
    try {
      const configuration = await fetchJson(SETTINGS_URL);
      scheduleSettings = normalizeScheduleSettings(configuration);
    } catch (error) {
      scheduleSettings = cloneObject(fallbackScheduleSettings);
      console.error(
        "Unable to load schedule-settings.json. Using fallback settings.",
        error
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * MESSAGE DATA
   * ------------------------------------------------------------
   */

  async function refreshMessages() {
    try {
      const configuration = await fetchJson(MESSAGES_URL);
      const messages = Array.isArray(configuration.messages)
        ? configuration.messages.filter((message) => {
            return Boolean(
              message &&
              typeof message.text === "string" &&
              message.text.trim()
            );
          })
        : [];

      if (messages.length === 0) {
        throw new Error("The message list is empty.");
      }

      messageSettings = {
        defaultDuration: positiveNumber(
          configuration.defaultDuration,
          fallbackMessageSettings.defaultDuration
        ),
        transitionDuration: positiveNumber(
          configuration.transitionDuration,
          fallbackMessageSettings.transitionDuration
        ),
        messages
      };
    } catch (error) {
      console.error(
        "Unable to load messages.json. Using fallback messages.",
        error
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * SCHEDULE PROCESSING
   * ------------------------------------------------------------
   */

  function getScheduleEntries(scheduleDocument) {
    if (Array.isArray(scheduleDocument)) {
      return scheduleDocument;
    }

    if (
      isPlainObject(scheduleDocument) &&
      Array.isArray(scheduleDocument.entries)
    ) {
      return scheduleDocument.entries;
    }

    return [];
  }

  function normalizeSchedule(scheduleDocument) {
    const entries = getScheduleEntries(scheduleDocument);

    return entries
      .map((entry, index) => {
        if (!isPlainObject(entry)) {
          return null;
        }

        const startUtc = validString(entry.startUtc, "");
        const startTime = Date.parse(startUtc);

        if (!startUtc || !Number.isFinite(startTime)) {
          console.warn(
            "Skipping schedule entry with an invalid startUtc timestamp.",
            entry
          );
          return null;
        }

        let endTime = Number.NaN;
        const endUtc = validString(entry.endUtc, "");

        if (endUtc) {
          endTime = Date.parse(endUtc);
        }

        if (!Number.isFinite(endTime)) {
          const durationMinutes = positiveNumber(
            entry.durationMinutes,
            scheduleSettings.defaultSlotMinutes
          );

          endTime = startTime + durationMinutes * 60 * 1000;
        }

        if (endTime <= startTime) {
          console.warn(
            "Skipping schedule entry whose end time is not after its start time.",
            entry
          );
          return null;
        }

        return {
          raw: entry,
          id: validString(
            entry.id,
            `schedule-entry-${index}-${startTime}`
          ),
          startTime,
          endTime
        };
      })
      .filter(Boolean)
      .sort((first, second) => {
        return first.startTime - second.startTime;
      });
  }

  function makeSelection(
    state,
    entries,
    startIndex,
    isFinalBlock = false
  ) {
    return {
      state,
      isFinalBlock,
      now: entries[startIndex] || null,
      next: entries[startIndex + 1] || null,
      after: entries[startIndex + 2] || null,
      later: entries[startIndex + 3] || null
    };
  }

  function selectTestScheduleEntries(entries) {
    const testMode = scheduleSettings.testMode;

    if (testMode.state === "before") {
      return {
        state: "before",
        isFinalBlock: false,
        now: null,
        next: entries[0] || null,
        after: entries[1] || null,
        later: entries[2] || null
      };
    }

    if (testMode.state === "after") {
      return {
        state: "after",
        isFinalBlock: false,
        now: null,
        next: null,
        after: null,
        later: null
      };
    }

    const startIndex = Math.min(
      testMode.startIndex,
      Math.max(entries.length - 1, 0)
    );

    return makeSelection(
      "live",
      entries,
      startIndex,
      startIndex === entries.length - 1
    );
  }

  function selectScheduleEntries(entries) {
    if (entries.length === 0) {
      return {
        state: "empty",
        isFinalBlock: false,
        now: null,
        next: null,
        after: null,
        later: null
      };
    }

    if (scheduleSettings.testMode.enabled) {
      return selectTestScheduleEntries(entries);
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
        later: entries[2] || null
      };
    }

    const currentIndex = entries.findIndex((entry) => {
      return (
        currentTime >= entry.startTime &&
        currentTime < entry.endTime
      );
    });

    if (currentIndex >= 0) {
      return makeSelection(
        "live",
        entries,
        currentIndex,
        currentIndex === entries.length - 1
      );
    }

    const upcomingIndex = entries.findIndex((entry) => {
      return entry.startTime > currentTime;
    });

    if (upcomingIndex >= 0) {
      return {
        state: "between",
        isFinalBlock: false,
        now: null,
        next: entries[upcomingIndex] || null,
        after: entries[upcomingIndex + 1] || null,
        later: entries[upcomingIndex + 2] || null
      };
    }

    if (currentTime >= lastEntry.endTime) {
      return {
        state: "after",
        isFinalBlock: false,
        now: null,
        next: null,
        after: null,
        later: null
      };
    }

    return {
      state: "empty",
      isFinalBlock: false,
      now: null,
      next: null,
      after: null,
      later: null
    };
  }

  /*
   * ------------------------------------------------------------
   * STATE-SPECIFIC FALLBACK TEXT
   * ------------------------------------------------------------
   */

  function getFallbackText(label, selectedEntries) {
    const text = scheduleSettings.stateText;

    if (selectedEntries.state === "empty") {
      const emptyText = {
        NOW: text.emptyNow,
        NEXT: text.emptyNext,
        AFTER: text.emptyAfter,
        LATER: text.emptyLater
      };

      return emptyText[label];
    }

    if (selectedEntries.state === "before") {
      if (label === "NOW") {
        return text.beforeEventNow;
      }
    }

    if (selectedEntries.state === "between") {
      if (label === "NOW") {
        return text.betweenBlocksNow;
      }
    }

    if (selectedEntries.state === "after") {
      const afterText = {
        NOW: text.afterEventNow,
        NEXT: text.afterEventNext,
        AFTER: text.afterEventAfter,
        LATER: text.afterEventLater
      };

      return afterText[label];
    }

    if (selectedEntries.isFinalBlock) {
      const finalText = {
        NEXT: text.finalBlockNext,
        AFTER: text.finalBlockAfter,
        LATER: text.finalBlockLater
      };

      if (finalText[label]) {
        return finalText[label];
      }
    }

    const standardText = {
      NOW: text.emptyNow,
      NEXT: text.noUpcoming,
      AFTER: text.noFollowing,
      LATER: text.noLater
    };

    return standardText[label];
  }

  /*
   * ------------------------------------------------------------
   * ELEMENT CREATION
   * ------------------------------------------------------------
   */

  function createScheduleItem(label, entry, fallbackText) {
    const item = document.createElement("span");
    item.className = "schedule-item";

    const labelElement = document.createElement("span");
    labelElement.className = "schedule-label";
    labelElement.textContent = `${label}:`;
    item.appendChild(labelElement);

    if (!entry) {
      const fallbackElement = document.createElement("span");
      fallbackElement.className = "schedule-game";
      fallbackElement.textContent = fallbackText;
      item.appendChild(fallbackElement);
      return item;
    }

    const gameTitle = validString(
      entry.raw.gameTitle,
      "GAME TBA"
    );
    const streamerName = validString(
      entry.raw.streamerName,
      "TBA"
    );

    const gameElement = document.createElement("span");
    gameElement.className = "schedule-game";
    gameElement.textContent = gameTitle.toUpperCase();

    const withElement = document.createElement("span");
    withElement.className = "schedule-with";
    withElement.textContent = "w/";

    const streamerElement = document.createElement("span");
    streamerElement.className = "schedule-streamer";
    streamerElement.textContent = streamerName;

    item.appendChild(gameElement);
    item.appendChild(withElement);
    item.appendChild(streamerElement);

    return item;
  }

  function createSeparator() {
    const separator = document.createElement("span");
    separator.className = "schedule-separator";
    separator.textContent = "|";
    return separator;
  }

  function buildEntrySignature(entry) {
    if (!entry) {
      return "";
    }

    return [
      entry.id,
      entry.startTime,
      entry.endTime,
      entry.raw.gameTitle || "",
      entry.raw.streamerName || ""
    ].join("~");
  }

  function buildSignature(entries) {
    return [
      entries.state,
      entries.isFinalBlock ? "final" : "not-final",
      buildEntrySignature(entries.now),
      buildEntrySignature(entries.next),
      buildEntrySignature(entries.after),
      buildEntrySignature(entries.later)
    ].join("|");
  }

  /*
   * ------------------------------------------------------------
   * WIDTH MEASUREMENT
   * ------------------------------------------------------------
   */

  function getOuterWidth(element) {
    const styles = window.getComputedStyle(element);
    const marginLeft = Number.parseFloat(styles.marginLeft) || 0;
    const marginRight = Number.parseFloat(styles.marginRight) || 0;

    return (
      element.getBoundingClientRect().width +
      marginLeft +
      marginRight
    );
  }

  function sumChildWidths(children, startIndex, endIndex) {
    let total = 0;

    for (
      let index = startIndex;
      index <= endIndex;
      index += 1
    ) {
      total += getOuterWidth(children[index]);
    }

    return total;
  }

  function fitAndMeasureTrack(track) {
    const maximumFontSize = 20;
    const minimumFontSize = 12;
    const safetyPadding = 10;

    let fontSize = maximumFontSize;
    let children = Array.from(track.children);
    let initialGroupWidth = 0;
    let laterGroupWidth = 0;

    while (fontSize >= minimumFontSize) {
      track.style.fontSize = `${fontSize}px`;
      void track.offsetWidth;

      children = Array.from(track.children);

      /* NOW | NEXT | AFTER */
      initialGroupWidth = sumChildWidths(children, 0, 4);

      /* NEXT | AFTER | LATER */
      laterGroupWidth = sumChildWidths(children, 2, 6);

      const widestView = Math.max(
        initialGroupWidth,
        laterGroupWidth
      );

      if (
        widestView <=
        scheduleLine.clientWidth - safetyPadding
      ) {
        break;
      }

      fontSize -= 1;
    }

    const nowAndSeparatorWidth = sumChildWidths(
      children,
      0,
      1
    );

    /* Center NOW / NEXT / AFTER. */
    const initialOffset =
      (scheduleLine.clientWidth - initialGroupWidth) / 2;

    /*
     * Center NEXT / AFTER / LATER.
     *
     * Subtracting the width of NOW and its separator accounts for
     * their position at the beginning of the full track.
     */
    const laterOffset =
      (scheduleLine.clientWidth - laterGroupWidth) / 2 -
      nowAndSeparatorWidth;

    return {
      initialOffset,
      laterOffset
    };
  }

  function fitMessageText(messageLayer) {
    const maximumFontSize = 20;
    const minimumFontSize = 12;
    let fontSize = maximumFontSize;

    messageLayer.style.fontSize = `${fontSize}px`;

    while (
      messageLayer.scrollWidth > messageLayer.clientWidth &&
      fontSize > minimumFontSize
    ) {
      fontSize -= 1;
      messageLayer.style.fontSize = `${fontSize}px`;
    }
  }

  /*
   * ------------------------------------------------------------
   * ANIMATION HELPERS
   * ------------------------------------------------------------
   */

  function setNowVisibility(nowPieces, isVisible) {
    nowPieces.forEach((piece) => {
      piece.classList.toggle("is-hidden", !isVisible);
    });
  }

  function setLaterVisibility(laterPieces, isVisible) {
    laterPieces.forEach((piece) => {
      piece.classList.toggle("is-visible", isVisible);
    });
  }

  async function showMessages(messageLayer, version) {
    const messages = messageSettings.messages;
    const transitionDuration =
      messageSettings.transitionDuration;

    messageLayer.style.transitionDuration =
      `${transitionDuration}ms`;

    for (const message of messages) {
      if (
        version !== animationVersion ||
        !messageLayer.isConnected
      ) {
        return false;
      }

      messageLayer.textContent = message.text;
      fitMessageText(messageLayer);
      messageLayer.classList.add("is-visible");

      const duration = positiveNumber(
        message.duration,
        messageSettings.defaultDuration
      );

      await wait(duration);

      if (
        version !== animationVersion ||
        !messageLayer.isConnected
      ) {
        return false;
      }

      messageLayer.classList.remove("is-visible");
      await wait(transitionDuration);
    }

    return true;
  }

  async function runPresentationCycle(
    track,
    offsets,
    nowPieces,
    laterPieces,
    messageLayer,
    version
  ) {
    const timing = scheduleSettings.timing;

    while (
      version === animationVersion &&
      track.isConnected
    ) {
      /* Opening centered view: NOW | NEXT | AFTER */
      await wait(timing.initialViewDuration);

      if (
        version !== animationVersion ||
        !track.isConnected
      ) {
        return;
      }

      /* Fade NOW and its separator away first. */
      setNowVisibility(nowPieces, false);

      await wait(
        timing.nowFadeDuration +
        timing.slideDelayAfterNowFade
      );

      if (
        version !== animationVersion ||
        !track.isConnected
      ) {
        return;
      }

      /* Slide the remaining schedule into its new center. */
      track.style.transform =
        `translateX(${offsets.laterOffset}px)`;

      await wait(timing.laterRevealDelay);

      if (
        version !== animationVersion ||
        !track.isConnected
      ) {
        return;
      }

      /* Reveal LATER as the slide finishes. */
      setLaterVisibility(laterPieces, true);

      await wait(
        Math.max(
          timing.slideDuration - timing.laterRevealDelay,
          0
        ) + timing.laterViewDuration
      );

      if (
        version !== animationVersion ||
        !track.isConnected
      ) {
        return;
      }

      /* Fade the schedule track out. */
      track.classList.add("is-hidden");
      await wait(timing.scheduleFadeDuration);

      if (
        version !== animationVersion ||
        !track.isConnected
      ) {
        return;
      }

      /* Restore the opening schedule while it is hidden. */
      setNowVisibility(nowPieces, true);
      setLaterVisibility(laterPieces, false);
      track.classList.add("no-transition");
      track.style.transform =
        `translateX(${offsets.initialOffset}px)`;
      void track.offsetWidth;
      track.classList.remove("no-transition");

      /* Display the informational messages. */
      const completedMessages = await showMessages(
        messageLayer,
        version
      );

      if (!completedMessages) {
        return;
      }

      if (
        version !== animationVersion ||
        !track.isConnected
      ) {
        return;
      }

      /* Return to centered NOW / NEXT / AFTER. */
      track.classList.remove("is-hidden");
      await wait(timing.scheduleFadeDuration);
    }
  }

  /*
   * ------------------------------------------------------------
   * RENDERING
   * ------------------------------------------------------------
   */

  async function displaySchedule(selectedEntries) {
    const signature = buildSignature(selectedEntries);

    if (
      hasLoadedSchedule &&
      signature === lastScheduleSignature
    ) {
      return;
    }

    lastScheduleSignature = signature;
    animationVersion += 1;

    const currentVersion = animationVersion;
    const timing = scheduleSettings.timing;

    const track = document.createElement("div");
    track.className = "schedule-track no-transition";

    const nowItem = createScheduleItem(
      "NOW",
      selectedEntries.now,
      getFallbackText("NOW", selectedEntries)
    );
    nowItem.classList.add("schedule-now-piece");
    track.appendChild(nowItem);

    const nowSeparator = createSeparator();
    nowSeparator.classList.add("schedule-now-piece");
    track.appendChild(nowSeparator);

    track.appendChild(
      createScheduleItem(
        "NEXT",
        selectedEntries.next,
        getFallbackText("NEXT", selectedEntries)
      )
    );

    track.appendChild(createSeparator());

    track.appendChild(
      createScheduleItem(
        "AFTER",
        selectedEntries.after,
        getFallbackText("AFTER", selectedEntries)
      )
    );

    const laterSeparator = createSeparator();
    laterSeparator.classList.add("schedule-later-piece");
    track.appendChild(laterSeparator);

    const laterItem = createScheduleItem(
      "LATER",
      selectedEntries.later,
      getFallbackText("LATER", selectedEntries)
    );
    laterItem.classList.add("schedule-later-piece");
    track.appendChild(laterItem);

    const messageLayer = document.createElement("div");
    messageLayer.className = "schedule-message-layer";

    scheduleLine.replaceChildren(track, messageLayer);
    hasLoadedSchedule = true;

    await brieflyWaitForFonts();
    await nextFrame();
    await nextFrame();

    if (
      currentVersion !== animationVersion ||
      !track.isConnected
    ) {
      return;
    }

    const offsets = fitAndMeasureTrack(track);

    track.style.transitionDuration =
      `${timing.slideDuration}ms, ` +
      `${timing.scheduleFadeDuration}ms`;

    /* Begin centered on NOW / NEXT / AFTER. */
    track.style.transform =
      `translateX(${offsets.initialOffset}px)`;
    void track.offsetWidth;

    await nextFrame();
    await nextFrame();

    track.classList.remove("no-transition");

    const nowPieces = Array.from(
      track.querySelectorAll(".schedule-now-piece")
    );
    const laterPieces = Array.from(
      track.querySelectorAll(".schedule-later-piece")
    );

    runPresentationCycle(
      track,
      offsets,
      nowPieces,
      laterPieces,
      messageLayer,
      currentVersion
    );
  }

  /*
   * ------------------------------------------------------------
   * SCHEDULE FETCHING
   * ------------------------------------------------------------
   */

  async function refreshSchedule() {
    try {
      const scheduleDocument = await fetchJson(SCHEDULE_URL);
      const normalizedSchedule = normalizeSchedule(
        scheduleDocument
      );
      const selectedEntries = selectScheduleEntries(
        normalizedSchedule
      );

      await displaySchedule(selectedEntries);
    } catch (error) {
      console.error(
        "Unable to load the Mario Mania schedule.",
        error
      );

      if (!hasLoadedSchedule) {
        scheduleLine.textContent =
          "SCHEDULE TEMPORARILY UNAVAILABLE";
      }
    }
  }

  async function initialize() {
    await loadScheduleSettings();
    await refreshMessages();
    await refreshSchedule();

    window.setInterval(
      refreshSchedule,
      scheduleSettings.scheduleRefreshInterval
    );

    window.setInterval(
      refreshMessages,
      scheduleSettings.messagesRefreshInterval
    );
  }

  initialize();
})();
