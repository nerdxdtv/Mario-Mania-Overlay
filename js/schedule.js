/*
 * Mario Mania Marathon 2027
 * Animated schedule and informational message bar
 */

(function () {
    "use strict";

    /*
     * ------------------------------------------------------------
     * CONFIGURATION
     * ------------------------------------------------------------
     */

    const SCHEDULE_URL =
        "https://gist.githubusercontent.com/nerdxdtv/ee4d75e1de028f2d3ab5853a164ce935/raw/47381d77ff7b276442ffe8f7dce41ee843b8428a/schedule.json";

    const MESSAGES_URL =
        "../data/messages.json";

    const EVENT_TIME_ZONE =
        "America/New_York";

    const SCHEDULE_REFRESH_INTERVAL =
        15000;

    const MESSAGES_REFRESH_INTERVAL =
        60000;

    const DEFAULT_SLOT_MINUTES =
        120;

    /*
     * Schedule animation timing.
     */
    const INITIAL_VIEW_DURATION =
        5000;

    const SLIDE_DURATION =
        900;

    const LATER_REVEAL_DELAY =
        600;

    const LATER_VIEW_DURATION =
        5000;

    const SCHEDULE_FADE_DURATION =
        500;

    /*
     * Last year's event has ended, so test mode
     * selects historical entries directly.
     */
    const TEST_MODE =
        true;

    const TEST_START_INDEX =
        0;

    const scheduleLine =
        document.getElementById("schedule-line");

    if (!scheduleLine) {
        return;
    }

    const fallbackMessageSettings = {
        defaultDuration: 5000,
        transitionDuration: 500,
        messages: [
            {
                text:
                    "Mario Mania benefits March of Dimes!"
            },
            {
                text:
                    "...but only because of YOU!"
            },
            {
                text:
                    "$5 can support newborn screenings through March of Dimes Advocacy.",
                duration:
                    6500
            },
            {
                text:
                    "Donate at MarioManiaMarathon.com"
            }
        ]
    };

    let messageSettings = {
        ...fallbackMessageSettings,
        messages: [
            ...fallbackMessageSettings.messages
        ]
    };

    let lastScheduleSignature = "";
    let hasLoadedSchedule = false;
    let animationVersion = 0;

    /*
     * ------------------------------------------------------------
     * GENERAL HELPERS
     * ------------------------------------------------------------
     */

    function wait(milliseconds) {
        return new Promise((resolve) => {
            window.setTimeout(
                resolve,
                milliseconds
            );
        });
    }

    function nextFrame() {
        return new Promise((resolve) => {
            window.requestAnimationFrame(
                resolve
            );
        });
    }

    function padTwo(value) {
        return String(value).padStart(
            2,
            "0"
        );
    }

    async function brieflyWaitForFonts() {
        if (
            !document.fonts ||
            !document.fonts.ready
        ) {
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
     * MESSAGE DATA
     * ------------------------------------------------------------
     */

    async function refreshMessages() {
        try {
            const separator =
                MESSAGES_URL.includes("?")
                    ? "&"
                    : "?";

            const response = await fetch(
                `${MESSAGES_URL}${separator}t=${Date.now()}`,
                {
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Message request returned status ${response.status}.`
                );
            }

            const configuration =
                await response.json();

            const messages =
                Array.isArray(configuration.messages)
                    ? configuration.messages.filter(
                        (message) => {
                            return (
                                message &&
                                typeof message.text ===
                                    "string" &&
                                message.text.trim()
                            );
                        }
                    )
                    : [];

            if (messages.length === 0) {
                throw new Error(
                    "The message list is empty."
                );
            }

            messageSettings = {
                defaultDuration:
                    Number.isFinite(
                        configuration.defaultDuration
                    )
                        ? configuration.defaultDuration
                        : fallbackMessageSettings.defaultDuration,

                transitionDuration:
                    Number.isFinite(
                        configuration.transitionDuration
                    )
                        ? configuration.transitionDuration
                        : fallbackMessageSettings.transitionDuration,

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
     * DATE HELPERS
     * ------------------------------------------------------------
     */

    function parseStartFromId(id) {
        if (
            !id ||
            typeof id !== "string"
        ) {
            return null;
        }

        const match = id.match(
            /^(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})$/
        );

        if (!match) {
            return null;
        }

        return {
            year: Number(match[1]),
            month: Number(match[2]),
            day: Number(match[3]),
            hour: Number(match[4]),
            minute: Number(match[5]),
            second: 0
        };
    }

    function partsToSortableNumber(parts) {
        return Number(
            String(parts.year) +
            padTwo(parts.month) +
            padTwo(parts.day) +
            padTwo(parts.hour) +
            padTwo(parts.minute) +
            padTwo(parts.second || 0)
        );
    }

    function addMinutesToParts(
        parts,
        minutes
    ) {
        const date = new Date(
            Date.UTC(
                parts.year,
                parts.month - 1,
                parts.day,
                parts.hour,
                parts.minute,
                parts.second || 0
            )
        );

        date.setUTCMinutes(
            date.getUTCMinutes() + minutes
        );

        return {
            year: date.getUTCFullYear(),
            month: date.getUTCMonth() + 1,
            day: date.getUTCDate(),
            hour: date.getUTCHours(),
            minute: date.getUTCMinutes(),
            second: date.getUTCSeconds()
        };
    }

    function getCurrentEasternParts() {
        const formatter =
            new Intl.DateTimeFormat(
                "en-US",
                {
                    timeZone:
                        EVENT_TIME_ZONE,

                    year:
                        "numeric",

                    month:
                        "2-digit",

                    day:
                        "2-digit",

                    hour:
                        "2-digit",

                    minute:
                        "2-digit",

                    second:
                        "2-digit",

                    hourCycle:
                        "h23"
                }
            );

        const parts =
            formatter
                .formatToParts(new Date())
                .reduce(
                    (result, part) => {
                        result[part.type] =
                            part.value;

                        return result;
                    },
                    {}
                );

        return {
            year: Number(parts.year),
            month: Number(parts.month),
            day: Number(parts.day),
            hour: Number(parts.hour),
            minute: Number(parts.minute),
            second: Number(parts.second)
        };
    }

    /*
     * ------------------------------------------------------------
     * SCHEDULE PROCESSING
     * ------------------------------------------------------------
     */

    function normalizeSchedule(schedule) {
        if (!Array.isArray(schedule)) {
            return [];
        }

        return schedule
            .map((entry) => {
                const startParts =
                    parseStartFromId(entry.id);

                if (!startParts) {
                    return null;
                }

                const providedDuration =
                    Number(entry.durationMinutes);

                const durationMinutes =
                    Number.isFinite(providedDuration)
                        ? providedDuration
                        : DEFAULT_SLOT_MINUTES;

                const endParts =
                    addMinutesToParts(
                        startParts,
                        durationMinutes
                    );

                return {
                    raw: entry,

                    startNumber:
                        partsToSortableNumber(
                            startParts
                        ),

                    endNumber:
                        partsToSortableNumber(
                            endParts
                        )
                };
            })
            .filter(Boolean)
            .sort((first, second) => {
                return (
                    first.startNumber -
                    second.startNumber
                );
            });
    }

    function selectScheduleEntries(entries) {
        if (TEST_MODE) {
            return {
                now:
                    entries[
                        TEST_START_INDEX
                    ] || null,

                next:
                    entries[
                        TEST_START_INDEX + 1
                    ] || null,

                after:
                    entries[
                        TEST_START_INDEX + 2
                    ] || null,

                later:
                    entries[
                        TEST_START_INDEX + 3
                    ] || null
            };
        }

        const currentTime =
            partsToSortableNumber(
                getCurrentEasternParts()
            );

        const currentEntry =
            entries.find((entry) => {
                return (
                    currentTime >=
                        entry.startNumber &&
                    currentTime <
                        entry.endNumber
                );
            }) || null;

        if (currentEntry) {
            const currentIndex =
                entries.indexOf(currentEntry);

            return {
                now:
                    currentEntry,

                next:
                    entries[
                        currentIndex + 1
                    ] || null,

                after:
                    entries[
                        currentIndex + 2
                    ] || null,

                later:
                    entries[
                        currentIndex + 3
                    ] || null
            };
        }

        const upcomingEntry =
            entries.find((entry) => {
                return (
                    entry.startNumber >
                    currentTime
                );
            }) || null;

        if (upcomingEntry) {
            const upcomingIndex =
                entries.indexOf(upcomingEntry);

            return {
                now:
                    null,

                next:
                    upcomingEntry,

                after:
                    entries[
                        upcomingIndex + 1
                    ] || null,

                later:
                    entries[
                        upcomingIndex + 2
                    ] || null
            };
        }

        return {
            now: null,
            next: null,
            after: null,
            later: null
        };
    }

    /*
     * ------------------------------------------------------------
     * ELEMENT CREATION
     * ------------------------------------------------------------
     */

    function createScheduleItem(
        label,
        entry,
        fallbackText
    ) {
        const item =
            document.createElement("span");

        item.className =
            "schedule-item";

        const labelElement =
            document.createElement("span");

        labelElement.className =
            "schedule-label";

        labelElement.textContent =
            `${label}:`;

        item.appendChild(
            labelElement
        );

        if (!entry) {
            const fallbackElement =
                document.createElement("span");

            fallbackElement.className =
                "schedule-game";

            fallbackElement.textContent =
                fallbackText;

            item.appendChild(
                fallbackElement
            );

            return item;
        }

        const gameTitle =
            entry.raw.gameTitle ||
            "GAME TBA";

        const streamerName =
            entry.raw.streamerName ||
            "TBA";

        const gameElement =
            document.createElement("span");

        gameElement.className =
            "schedule-game";

        gameElement.textContent =
            gameTitle.toUpperCase();

        const withElement =
            document.createElement("span");

        withElement.className =
            "schedule-with";

        withElement.textContent =
            "w/";

        const streamerElement =
            document.createElement("span");

        streamerElement.className =
            "schedule-streamer";

        streamerElement.textContent =
            streamerName;

        item.appendChild(
            gameElement
        );

        item.appendChild(
            withElement
        );

        item.appendChild(
            streamerElement
        );

        return item;
    }

    function createSeparator() {
        const separator =
            document.createElement("span");

        separator.className =
            "schedule-separator";

        separator.textContent =
            "|";

        return separator;
    }

    function buildSignature(entries) {
        return [
            entries.now?.raw?.id || "",
            entries.next?.raw?.id || "",
            entries.after?.raw?.id || "",
            entries.later?.raw?.id || ""
        ].join("|");
    }

    /*
     * ------------------------------------------------------------
     * WIDTH MEASUREMENT
     * ------------------------------------------------------------
     */

    function getOuterWidth(element) {
        const styles =
            window.getComputedStyle(element);

        const marginLeft =
            Number.parseFloat(
                styles.marginLeft
            ) || 0;

        const marginRight =
            Number.parseFloat(
                styles.marginRight
            ) || 0;

        return (
            element.getBoundingClientRect().width +
            marginLeft +
            marginRight
        );
    }

    function sumChildWidths(
        children,
        startIndex,
        endIndex
    ) {
        let total = 0;

        for (
            let index = startIndex;
            index <= endIndex;
            index += 1
        ) {
            total +=
                getOuterWidth(
                    children[index]
                );
        }

        return total;
    }

    function fitAndMeasureTrack(track) {
        const maximumFontSize =
            20;

        const minimumFontSize =
            12;

        const safetyPadding =
            10;

        let fontSize =
            maximumFontSize;

        let children =
            Array.from(track.children);

        let initialGroupWidth =
            0;

        let laterGroupWidth =
            0;

        while (
            fontSize >= minimumFontSize
        ) {
            track.style.fontSize =
                `${fontSize}px`;

            void track.offsetWidth;

            children =
                Array.from(track.children);

            initialGroupWidth =
                sumChildWidths(
                    children,
                    0,
                    4
                );

            laterGroupWidth =
                sumChildWidths(
                    children,
                    2,
                    6
                );

            const widestView =
                Math.max(
                    initialGroupWidth,
                    laterGroupWidth
                );

            if (
                widestView <=
                scheduleLine.clientWidth -
                    safetyPadding
            ) {
                break;
            }

            fontSize -= 1;
        }

        const nowAndSeparatorWidth =
            sumChildWidths(
                children,
                0,
                1
            );

        return {
            initialOffset: 0,
            laterOffset: -nowAndSeparatorWidth
        };
    }

    function fitMessageText(messageLayer) {
        const maximumFontSize =
            20;

        const minimumFontSize =
            12;

        let fontSize =
            maximumFontSize;

        messageLayer.style.fontSize =
            `${fontSize}px`;

        while (
            messageLayer.scrollWidth >
                messageLayer.clientWidth &&
            fontSize >
                minimumFontSize
        ) {
            fontSize -= 1;

            messageLayer.style.fontSize =
                `${fontSize}px`;
        }
    }

    /*
     * ------------------------------------------------------------
     * ANIMATION HELPERS
     * ------------------------------------------------------------
     */

    function setLaterVisibility(
        laterPieces,
        isVisible
    ) {
        laterPieces.forEach((piece) => {
            piece.classList.toggle(
                "is-visible",
                isVisible
            );
        });
    }

    async function showMessages(
        messageLayer,
        version
    ) {
        const messages =
            messageSettings.messages;

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

            messageLayer.textContent =
                message.text;

            fitMessageText(
                messageLayer
            );

            messageLayer.classList.add(
                "is-visible"
            );

            const duration =
                Number.isFinite(message.duration)
                    ? message.duration
                    : messageSettings.defaultDuration;

            await wait(duration);

            if (
                version !== animationVersion ||
                !messageLayer.isConnected
            ) {
                return false;
            }

            messageLayer.classList.remove(
                "is-visible"
            );

            await wait(
                transitionDuration
            );
        }

        return true;
    }

    async function runPresentationCycle(
        track,
        offsets,
        laterPieces,
        messageLayer,
        version
    ) {
        while (
            version === animationVersion &&
            track.isConnected
        ) {
            /*
             * Initial view:
             *
             * NOW | NEXT | AFTER
             */
            await wait(
                INITIAL_VIEW_DURATION
            );

            if (
                version !== animationVersion ||
                !track.isConnected
            ) {
                return;
            }

            /*
             * Slide NOW away.
             */
            track.style.transform =
                `translateX(${offsets.laterOffset}px)`;

            await wait(
                LATER_REVEAL_DELAY
            );

            if (
                version !== animationVersion ||
                !track.isConnected
            ) {
                return;
            }

            /*
             * Reveal LATER near the end of the slide.
             */
            setLaterVisibility(
                laterPieces,
                true
            );

            await wait(
                Math.max(
                    SLIDE_DURATION -
                        LATER_REVEAL_DELAY,
                    0
                ) +
                LATER_VIEW_DURATION
            );

            if (
                version !== animationVersion ||
                !track.isConnected
            ) {
                return;
            }

            /*
             * Fade the schedule track out.
             */
            track.classList.add(
                "is-hidden"
            );

            await wait(
                SCHEDULE_FADE_DURATION
            );

            if (
                version !== animationVersion ||
                !track.isConnected
            ) {
                return;
            }

            /*
             * Reset the schedule while it is invisible.
             */
            setLaterVisibility(
                laterPieces,
                false
            );

            track.classList.add(
                "no-transition"
            );

            track.style.transform =
                `translateX(${offsets.initialOffset}px)`;

            void track.offsetWidth;

            track.classList.remove(
                "no-transition"
            );

            /*
             * Display the message sequence.
             */
            const completedMessages =
                await showMessages(
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

            /*
             * Return to NOW / NEXT / AFTER.
             */
            track.classList.remove(
                "is-hidden"
            );

            await wait(
                SCHEDULE_FADE_DURATION
            );
        }
    }

    /*
     * ------------------------------------------------------------
     * RENDERING
     * ------------------------------------------------------------
     */

    async function displaySchedule(
        selectedEntries
    ) {
        const signature =
            buildSignature(
                selectedEntries
            );

        if (
            hasLoadedSchedule &&
            signature ===
                lastScheduleSignature
        ) {
            return;
        }

        lastScheduleSignature =
            signature;

        animationVersion += 1;

        const currentVersion =
            animationVersion;

        const track =
            document.createElement("div");

        track.className =
            "schedule-track no-transition";

        track.appendChild(
            createScheduleItem(
                "NOW",
                selectedEntries.now,
                TEST_MODE
                    ? "TEST SLOT"
                    : "NOT LIVE"
            )
        );

        track.appendChild(
            createSeparator()
        );

        track.appendChild(
            createScheduleItem(
                "NEXT",
                selectedEntries.next,
                "NO UPCOMING SLOT"
            )
        );

        track.appendChild(
            createSeparator()
        );

        track.appendChild(
            createScheduleItem(
                "AFTER",
                selectedEntries.after,
                "NO FOLLOWING SLOT"
            )
        );

        const laterSeparator =
            createSeparator();

        laterSeparator.classList.add(
            "schedule-later-piece"
        );

        track.appendChild(
            laterSeparator
        );

        const laterItem =
            createScheduleItem(
                "LATER",
                selectedEntries.later,
                "NO LATER SLOT"
            );

        laterItem.classList.add(
            "schedule-later-piece"
        );

        track.appendChild(
            laterItem
        );

        const messageLayer =
            document.createElement("div");

        messageLayer.className =
            "schedule-message-layer";

        scheduleLine.replaceChildren(
            track,
            messageLayer
        );

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

        const offsets =
            fitAndMeasureTrack(track);

        track.style.transitionDuration =
            `${SLIDE_DURATION}ms, ` +
            `${SCHEDULE_FADE_DURATION}ms`;

        track.style.transform =
            `translateX(${offsets.initialOffset}px)`;

        void track.offsetWidth;

        await nextFrame();
        await nextFrame();

        track.classList.remove(
            "no-transition"
        );

        const laterPieces =
            Array.from(
                track.querySelectorAll(
                    ".schedule-later-piece"
                )
            );

        runPresentationCycle(
            track,
            offsets,
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
            const separator =
                SCHEDULE_URL.includes("?")
                    ? "&"
                    : "?";

            const response = await fetch(
                `${SCHEDULE_URL}${separator}t=${Date.now()}`,
                {
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Schedule request returned status ${response.status}.`
                );
            }

            const rawSchedule =
                await response.json();

            const normalizedSchedule =
                normalizeSchedule(
                    rawSchedule
                );

            if (
                normalizedSchedule.length === 0
            ) {
                throw new Error(
                    "The schedule contains no valid entries."
                );
            }

            const selectedEntries =
                selectScheduleEntries(
                    normalizedSchedule
                );

            await displaySchedule(
                selectedEntries
            );
        } catch (error) {
            console.error(
                "Unable to load Mario Mania schedule.",
                error
            );

            if (!hasLoadedSchedule) {
                scheduleLine.textContent =
                    "SCHEDULE TEMPORARILY UNAVAILABLE";
            }
        }
    }

    /*
     * Load the messages before beginning the first
     * schedule and message presentation cycle.
     */
    async function initialize() {
        await refreshMessages();
        await refreshSchedule();

        window.setInterval(
            refreshSchedule,
            SCHEDULE_REFRESH_INTERVAL
        );

        window.setInterval(
            refreshMessages,
            MESSAGES_REFRESH_INTERVAL
        );
    }

    initialize();
})();
