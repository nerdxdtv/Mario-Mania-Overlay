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
        const matchingPart = parts.find((part) => part.type === type);
        return matchingPart ? matchingPart.value : "";
    }

    function updateClock() {
        if (!clockElement) {
            return;
        }

        const now = new Date();

        const dateParts = dateFormatter.formatToParts(now);
        const timeParts = timeFormatter.formatToParts(now);

        const year = getPart(dateParts, "year");
        const month = getPart(dateParts, "month");
        const day = getPart(dateParts, "day");

        const hour = getPart(timeParts, "hour");
        const minute = getPart(timeParts, "minute");
        const dayPeriod = getPart(timeParts, "dayPeriod");
        const timeZone = getPart(timeParts, "timeZoneName");

        clockElement.textContent =
            `${year}-${month}-${day} ${hour}:${minute} ${dayPeriod} ${timeZone}`;
    }

    updateClock();
    window.setInterval(updateClock, 1000);

    /*
     * ------------------------------------------------------------
     * INFORMATIONAL IMAGE ROTATOR
     * ------------------------------------------------------------
     */

    const ROTATOR_DATA_URL = "../data/rotator.json";
    const rotatorImage = document.getElementById("rotator-image");

    const fallbackSlides = [
        {
            image: "../assets/rotator/march-of-dimes.png",
            alt: "March of Dimes",
            duration: 8000
        }
    ];

    function wait(milliseconds) {
        return new Promise((resolve) => {
            window.setTimeout(resolve, milliseconds);
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

    async function displaySlide(slide, transitionDuration) {
        rotatorImage.classList.remove("is-visible");

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
            rotatorImage.classList.add("is-visible");
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
            const response = await fetch(ROTATOR_DATA_URL, {
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error(
                    `Rotator data returned status ${response.status}`
                );
            }

            const configuration = await response.json();

            if (
                Array.isArray(configuration.slides) &&
                configuration.slides.length > 0
            ) {
                slides = configuration.slides;
            }

            if (Number.isFinite(configuration.defaultDuration)) {
                defaultDuration = configuration.defaultDuration;
            }

            if (Number.isFinite(configuration.transitionDuration)) {
                transitionDuration = configuration.transitionDuration;
            }
        } catch (error) {
            console.error(
                "Unable to load rotator.json. Using fallback slide.",
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
            const currentSlide = slides[currentSlideIndex];

            const slideDuration =
                Number.isFinite(currentSlide.duration)
                    ? currentSlide.duration
                    : defaultDuration;

            await wait(slideDuration);

            currentSlideIndex =
                (currentSlideIndex + 1) % slides.length;

            await displaySlide(
                slides[currentSlideIndex],
                transitionDuration
            );
        }
    }

    startRotator();
})();
