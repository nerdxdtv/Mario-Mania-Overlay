/*
 * Mario Mania Marathon 2027
 * Bottom schedule-bar functionality
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

    const EVENT_TIME_ZONE =
        "America/New_York";

    const REFRESH_INTERVAL =
        15000;

    const DEFAULT_SLOT_MINUTES =
        120;

    /*
     * Last year's event has already ended.
     *
     * Test mode displays three consecutive entries
     * from the old schedule instead of looking for
     * a currently live 2026 slot.
     *
     * Change this to false when the 2027 schedule
     * is ready and contains the real event dates.
     */
    const TEST_MODE = true;

    /*
     * 0 means the first three schedule entries.
     *
     * Change this to 1, 2, 3, and so forth to
     * preview different groups from the schedule.
     */
    const TEST_START_INDEX = 0;

    const scheduleLine =
        document.getElementById("schedule-line");

    if (!scheduleLine) {
        return;
    }

    let lastScheduleSignature = "";
    let hasLoadedSchedule = false;

    /*
     * ------------------------------------------------------------
     * DATE AND TIME HELPERS
     * ------------------------------------------------------------
     */

    function parseStartFromId(id) {
        if (
            !id ||
            typeof id !== "string"
        ) {
            return null;
        }

        /*
         * Expected ID format:
         *
         * 2026-03-27-0800
         */
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

    function padTwo(value) {
        return String(value).padStart(2, "0");
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

        const formattedParts =
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
            year:
                Number(formattedParts.year),

            month:
                Number(formattedParts.month),

            day:
                Number(formattedParts.day),

            hour:
                Number(formattedParts.hour),

            minute:
                Number(formattedParts.minute),

            second:
                Number(formattedParts.second)
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
        /*
         * For testing, simply display three entries
         * from the old schedule.
         */
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
                    ] || null
            };
        }

        const currentEasternTime =
            partsToSortableNumber(
                getCurrentEasternParts()
            );

        const currentEntry =
            entries.find((entry) => {
                return (
                    currentEasternTime >=
                        entry.startNumber &&
                    currentEasternTime <
                        entry.endNumber
                );
            }) || null;

        /*
         * During the event:
         *
         * NOW   = current block
         * NEXT  = following block
         * AFTER = block after that
         */
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
                    ] || null
            };
        }

        /*
         * Before the event begins, NOW will say
         * NOT LIVE while NEXT and AFTER show the
         * first two upcoming blocks.
         */
        const firstUpcomingEntry =
            entries.find((entry) => {
                return (
                    entry.startNumber >
                    currentEasternTime
                );
            }) || null;

        if (firstUpcomingEntry) {
            const upcomingIndex =
                entries.indexOf(
                    firstUpcomingEntry
                );

            return {
                now:
                    null,

                next:
                    firstUpcomingEntry,

                after:
                    entries[
                        upcomingIndex + 1
                    ] || null
            };
        }

        /*
         * The entire event has ended.
         */
        return {
            now: null,
            next: null,
            after: null
        };
    }

    /*
     * ------------------------------------------------------------
     * SCHEDULE HTML
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

    function buildSignature(selectedEntries) {
        return [
            selectedEntries.now?.raw?.id || "",
            selectedEntries.next?.raw?.id || "",
            selectedEntries.after?.raw?.id || ""
        ].join("|");
    }

    function fitScheduleText() {
        /*
         * Start at the existing 20-pixel size.
         * Reduce it only when the selected games
         * and streamer names do not fit.
         */
        const maximumFontSize = 20;
        const minimumFontSize = 12;

        let fontSize =
            maximumFontSize;

        scheduleLine.style.fontSize =
            `${fontSize}px`;

        while (
            scheduleLine.scrollWidth >
                scheduleLine.clientWidth &&
            fontSize >
                minimumFontSize
        ) {
            fontSize -= 1;

            scheduleLine.style.fontSize =
                `${fontSize}px`;
        }
    }

    function displaySchedule(
        selectedEntries
    ) {
        const signature =
            buildSignature(selectedEntries);

        /*
         * Avoid rebuilding the line every fifteen
         * seconds when nothing has changed.
         */
        if (
            hasLoadedSchedule &&
            signature ===
                lastScheduleSignature
        ) {
            return;
        }

        lastScheduleSignature =
            signature;

        const content =
            document.createDocumentFragment();

        content.appendChild(
            createScheduleItem(
                "NOW",
                selectedEntries.now,
                TEST_MODE
                    ? "TEST SLOT"
                    : "NOT LIVE"
            )
        );

        content.appendChild(
            createSeparator()
        );

        content.appendChild(
            createScheduleItem(
                "NEXT",
                selectedEntries.next,
                "NO UPCOMING SLOT"
            )
        );

        content.appendChild(
            createSeparator()
        );

        content.appendChild(
            createScheduleItem(
                "AFTER",
                selectedEntries.after,
                "NO FOLLOWING SLOT"
            )
        );

        scheduleLine.replaceChildren(
            content
        );

        hasLoadedSchedule = true;

        /*
         * Wait until the browser finishes laying
         * out the new text before measuring it.
         */
        window.requestAnimationFrame(() => {
            fitScheduleText();

            if (
                document.fonts &&
                document.fonts.ready
            ) {
                document.fonts.ready.then(
                    fitScheduleText
                );
            }
        });
    }

    /*
     * ------------------------------------------------------------
     * FETCH AND REFRESH
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

            const schedule =
                await response.json();

            const normalizedSchedule =
                normalizeSchedule(schedule);

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

            displaySchedule(
                selectedEntries
            );
        } catch (error) {
            console.error(
                "Unable to load Mario Mania schedule.",
                error
            );

            /*
             * If a schedule has already loaded,
             * leave the last successful information
             * on screen rather than replacing it.
             */
            if (!hasLoadedSchedule) {
                scheduleLine.textContent =
                    "SCHEDULE TEMPORARILY UNAVAILABLE";

                fitScheduleText();
            }
        }
    }

    refreshSchedule();

    window.setInterval(
        refreshSchedule,
        REFRESH_INTERVAL
    );
})();
