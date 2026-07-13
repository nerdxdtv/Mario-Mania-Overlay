/*
 * Mario Mania Marathon 2027
 * Shared overlay functionality
 */

(function () {
    "use strict";

    /*
     * ------------------------------------------------------------
     * EASTERN DATE AND TIME
     * ------------------------------------------------------------
     */

    const EASTERN_TIME_ZONE = "America/New_York";
    const clockElement = document.getElementById("event-clock");

    const dateFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: EASTERN_TIME_ZONE,
        year: "numeric",
        month: "numeric",
        day: "numeric"
    });

    const timeFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: EASTERN_TIME_ZONE,
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZoneName: "short"
    });

    function getPart(parts, type) {
        const matchingPart = parts.find((part) => {
            return part.type === type;
        });

        return matchingPart ? matchingPart.value : "";
    }

    function updateClock() {
        if (!clockElement) {
            return;
        }

        const now = new Date();

        const dateParts =
            dateFormatter.formatToParts(now);

        const timeParts =
            timeFormatter.formatToParts(now);

        const year = getPart(dateParts, "year");
        const month = getPart(dateParts, "month");
        const day = getPart(dateParts, "day");

        const hour = getPart(timeParts, "hour");
        const minute = getPart(timeParts, "minute");
        const dayPeriod = getPart(timeParts, "dayPeriod");
        const timeZone = getPart(timeParts, "timeZoneName");

        clockElement.textContent =
            `${year}-${month}-${day} ` +
            `${hour}:${minute} ${dayPeriod} ${timeZone}`;
    }

    updateClock();

    window.setInterval(
        updateClock,
        1000
    );

    /*
     * ------------------------------------------------------------
     * INFORMATIONAL IMAGE ROTATOR
     * ------------------------------------------------------------
     */

    const ROTATOR_DATA_URL =
        "../data/rotator.json";

    const rotatorImage =
        document.getElementById("rotator-image");

    const fallbackSlides = [
        {
            image:
                "../assets/rotator/march-of-dimes.png",
            alt:
                "March of Dimes",
            duration:
                8000
        }
    ];

    function wait(milliseconds) {
        return new Promise((resolve) => {
            window.setTimeout(
                resolve,
                milliseconds
            );
        });
    }

    function preloadImage(source) {
        return new Promise((resolve, reject) => {
            const image = new Image();

            image.onload = resolve;
            image.onerror = reject;
            image.src = source;
        });
    }

    async function displaySlide(
        slide,
        transitionDuration
    ) {
        if (!rotatorImage) {
            return;
        }

        rotatorImage.classList.remove(
            "is-visible"
        );

        await wait(transitionDuration);

        try {
            await preloadImage(slide.image);
        } catch (error) {
            console.error(
                `Unable to load rotator image: ${slide.image}`,
                error
            );

            return;
        }

        rotatorImage.src = slide.image;
        rotatorImage.alt = slide.alt || "";

        window.requestAnimationFrame(() => {
            rotatorImage.classList.add(
                "is-visible"
            );
        });
    }

    async function startRotator() {
        if (!rotatorImage) {
            return;
        }

        let slides = fallbackSlides;
        let defaultDuration = 8000;
        let transitionDuration = 700;

        try {
            const response = await fetch(
                ROTATOR_DATA_URL,
                {
                    cache: "no-store"
                }
            );

            if (!response.ok) {
                throw new Error(
                    `Rotator data returned status ${response.status}`
                );
            }

            const configuration =
                await response.json();

            if (
                Array.isArray(configuration.slides) &&
                configuration.slides.length > 0
            ) {
                slides = configuration.slides;
            }

            if (
                Number.isFinite(
                    configuration.defaultDuration
                )
            ) {
                defaultDuration =
                    configuration.defaultDuration;
            }

            if (
                Number.isFinite(
                    configuration.transitionDuration
                )
            ) {
                transitionDuration =
                    configuration.transitionDuration;
            }
        } catch (error) {
            console.error(
                "Unable to load rotator.json. " +
                "Using fallback slide.",
                error
            );
        }

        rotatorImage.style.transitionDuration =
            `${transitionDuration}ms`;

        let currentSlideIndex = 0;

        await displaySlide(
            slides[currentSlideIndex],
            transitionDuration
        );

        while (true) {
            const currentSlide =
                slides[currentSlideIndex];

            const slideDuration =
                Number.isFinite(currentSlide.duration)
                    ? currentSlide.duration
                    : defaultDuration;

            await wait(slideDuration);

            currentSlideIndex =
                (currentSlideIndex + 1) %
                slides.length;

            await displaySlide(
                slides[currentSlideIndex],
                transitionDuration
            );
        }
    }

    startRotator();

    /*
     * ------------------------------------------------------------
     * LIVE TILTIFY DONATION TOTAL
     * ------------------------------------------------------------
     */

    const DONATION_WORKER_URL =
        "https://mario-mania-donations.kodychristian.workers.dev";

    const DONATION_FALLBACK_URL =
        "../data/donations.json";

    const DONATION_REFRESH_INTERVAL =
        15000;

    const donationTotalElement =
        document.getElementById(
            "donation-total"
        );

    function formatDonationTotal(
        total,
        currency
    ) {
        return new Intl.NumberFormat(
            "en-US",
            {
                style: "currency",
                currency: currency || "USD",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        ).format(total);
    }

    async function fetchDonationData(url) {
        const separator =
            url.includes("?") ? "&" : "?";

        const cacheBuster = Date.now();

        const response = await fetch(
            `${url}${separator}v=${cacheBuster}`,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Donation request returned status ${response.status}.`
            );
        }

        const donationData =
            await response.json();

        const total =
            Number(donationData.total);

        if (!Number.isFinite(total)) {
            throw new Error(
                "Donation total is missing or invalid."
            );
        }

        return {
            total,
            currency:
                donationData.currency || "USD"
        };
    }

    async function updateDonationTotal() {
        if (!donationTotalElement) {
            return;
        }

        let donationData;

        try {
            donationData =
                await fetchDonationData(
                    DONATION_WORKER_URL
                );
        } catch (workerError) {
            console.error(
                "Unable to load live Tiltify total. " +
                "Trying local fallback.",
                workerError
            );

            try {
                donationData =
                    await fetchDonationData(
                        DONATION_FALLBACK_URL
                    );
            } catch (fallbackError) {
                console.error(
                    "Unable to load fallback " +
                    "donation total.",
                    fallbackError
                );

                return;
            }
        }

        donationTotalElement.textContent =
            formatDonationTotal(
                donationData.total,
                donationData.currency
            );
    }

    updateDonationTotal();

    window.setInterval(
        updateDonationTotal,
        DONATION_REFRESH_INTERVAL
    );

    /*
     * ------------------------------------------------------------
     * BOTTOM SCHEDULE BAR
     * ------------------------------------------------------------
     */

    const SCHEDULE_URL =
        "https://gist.githubusercontent.com/nerdxdtv/ee4d75e1de028f2d3ab5853a164ce935/raw/47381d77ff7b276442ffe8f7dce41ee843b8428a/schedule.json";

    const SCHEDULE_REFRESH_INTERVAL =
        15000;

    /*
     * Last year's schedule has already ended.
     *
     * While this is true, the overlay displays
     * the first three schedule entries so that
     * positioning and styling can be tested.
     *
     * We will change this to false when the
     * 2027 schedule is ready.
     */
    const SCHEDULE_TEST_MODE = true;

    const SCHEDULE_TEST_START_INDEX = 0;
    const DEFAULT_SLOT_MINUTES = 120;

    const scheduleLine =
        document.getElementById(
            "schedule-line"
        );

    let hasPaintedSchedule = false;
    let lastScheduleSignature = "";

    function parseScheduleStart(id) {
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

    function getEasternTimeParts() {
        const formatter =
            new Intl.DateTimeFormat(
                "en-US",
                {
                    timeZone:
                        EASTERN_TIME_ZONE,
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

    function partsToSortableNumber(parts) {
        function padTwo(value) {
            return String(value).padStart(
                2,
                "0"
            );
        }

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

    function normalizeSchedule(schedule) {
        if (!Array.isArray(schedule)) {
            return [];
        }

        return schedule
            .map((item) => {
                const startParts =
                    parseScheduleStart(item.id);

                if (!startParts) {
                    return null;
                }

                const suppliedDuration =
                    Number(item.durationMinutes);

                const durationMinutes =
                    Number.isFinite(
                        suppliedDuration
                    )
                        ? suppliedDuration
                        : DEFAULT_SLOT_MINUTES;

                const startNumber =
                    partsToSortableNumber(
                        startParts
                    );

                const endParts =
                    addMinutesToParts(
                        startParts,
                        durationMinutes
                    );

                const endNumber =
                    partsToSortableNumber(
                        endParts
                    );

                return {
                    raw: item,
                    startParts,
                    startNumber,
                    endNumber
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

    function selectScheduleEntries(items) {
        if (SCHEDULE_TEST_MODE) {
            return {
                now:
                    items[
                        SCHEDULE_TEST_START_INDEX
                    ] || null,

                next:
                    items[
                        SCHEDULE_TEST_START_INDEX + 1
                    ] || null,

                after:
                    items[
                        SCHEDULE_TEST_START_INDEX + 2
                    ] || null
            };
        }

        const nowParts =
            getEasternTimeParts();

        const nowNumber =
            partsToSortableNumber(
                nowParts
            );

        const currentEntry =
            items.find((item) => {
                return (
                    nowNumber >=
                        item.startNumber &&
                    nowNumber <
                        item.endNumber
                );
            }) || null;

        if (currentEntry) {
            const currentIndex =
                items.indexOf(currentEntry);

            return {
                now:
                    currentEntry,

                next:
                    items[
                        currentIndex + 1
                    ] || null,

                after:
                    items[
                        currentIndex + 2
                    ] || null
            };
        }

        const upcomingEntry =
            items.find((item) => {
                return (
                    item.startNumber >
                    nowNumber
                );
            }) || null;

        if (upcomingEntry) {
            const upcomingIndex =
                items.indexOf(
                    upcomingEntry
                );

            return {
                now:
                    null,

                next:
                    upcomingEntry,

                after:
                    items[
                        upcomingIndex + 1
                    ] || null
            };
        }

        return {
            now: null,
            next: null,
            after: null
        };
    }

    function createScheduleSegment(
        label,
        entry,
        fallbackText
    ) {
        const segment =
            document.createElement("span");

        segment.className =
            "schedule-segment";

        const labelElement =
            document.createElement("span");

        labelElement.className =
            "schedule-label";

        labelElement.textContent =
            `${label}:`;

        segment.appendChild(
            labelElement
        );

        if (!entry) {
            const fallbackElement =
                document.createElement("span");

            fallbackElement.className =
                "schedule-game";

            fallbackElement.textContent =
                fallbackText;

            segment.appendChild(
                fallbackElement
            );

            return segment;
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

        withElement.textContent = "w/";

        const streamerElement =
            document.createElement("span");

        streamerElement.className =
            "schedule-streamer";

        streamerElement.textContent =
            streamerName;

        segment.appendChild(
            gameElement
        );

        segment.appendChild(
            withElement
        );

        segment.appendChild(
            streamerElement
        );

        return segment;
    }

    function createSeparator() {
        const separator =
            document.createElement("span");

        separator.className =
            "schedule-separator";

        separator.textContent = "|";

        return separator;
    }

    function fitScheduleText() {
        if (!scheduleLine) {
            return;
        }

        const maximumSize = 20;
        const minimumSize = 12;

        let currentSize = maximumSize;

        scheduleLine.style.fontSize =
            `${currentSize}px`;

        while (
            scheduleLine.scrollWidth >
                scheduleLine.clientWidth &&
            currentSize >
                minimumSize
        ) {
            currentSize -= 1;

            scheduleLine.style.fontSize =
                `${currentSize}px`;
        }
    }

    function buildScheduleSignature(
        selectedEntries
    ) {
        return [
            selectedEntries.now?.raw?.id || "",
            selectedEntries.next?.raw?.id || "",
            selectedEntries.after?.raw?.id || ""
        ].join("|");
    }

    function paintSchedule(
        selectedEntries
    ) {
        if (!scheduleLine) {
            return;
        }

        const replacement =
            document.createDocumentFragment();

        replacement.appendChild(
            createScheduleSegment(
                "NOW",
                selectedEntries.now,
                SCHEDULE_TEST_MODE
                    ? "TEST SLOT"
                    : "NOT LIVE"
            )
        );

        replacement.appendChild(
            createSeparator()
        );

        replacement.appendChild(
            createScheduleSegment(
                "NEXT",
                selectedEntries.next,
                "NO UPCOMING SLOT"
            )
        );

        replacement.appendChild(
            createSeparator()
        );

        replacement.appendChild(
            createScheduleSegment(
                "AFTER",
                selectedEntries.after,
                "NO FOLLOWING SLOT"
            )
        );

        scheduleLine.replaceChildren(
            replacement
        );

        window.requestAnimationFrame(() => {
            fitScheduleText();
        });
    }

    function updateScheduleDisplay(
        selectedEntries
    ) {
        const signature =
            buildScheduleSignature(
                selectedEntries
            );

        if (
            hasPaintedSchedule &&
            signature ===
                lastScheduleSignature
        ) {
            return;
        }

        lastScheduleSignature =
            signature;

        if (!hasPaintedSchedule) {
            paintSchedule(
                selectedEntries
            );

            hasPaintedSchedule = true;
            return;
        }

        scheduleLine.classList.add(
            "is-updating"
        );

        window.setTimeout(() => {
            paintSchedule(
                selectedEntries
            );

            scheduleLine.classList.remove(
                "is-updating"
            );
        }, 300);
    }

    async function refreshSchedule() {
        if (!scheduleLine) {
            return;
        }

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

            updateScheduleDisplay(
                selectedEntries
            );
        } catch (error) {
            console.error(
                "Unable to load schedule.",
                error
            );

            if (!hasPaintedSchedule) {
                scheduleLine.textContent =
                    "SCHEDULE TEMPORARILY UNAVAILABLE";

                fitScheduleText();
            }
        }
    }

    refreshSchedule();

    window.setInterval(
        refreshSchedule,
        SCHEDULE_REFRESH_INTERVAL
    );

    window.addEventListener(
        "resize",
        fitScheduleText
    );
})();
