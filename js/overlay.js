/*
 * Mario Mania Marathon 2027
 * Shared overlay functionality
 */

(function () {
    "use strict";

    const EASTERN_TIME_ZONE = "America/New_York";
    const clockElement = document.getElementById("event-clock");

    if (!clockElement) {
        return;
    }

    const dateFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: EASTERN_TIME_ZONE,
        weekday: "short",
        month: "short",
        day: "numeric"
    });

    const timeFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: EASTERN_TIME_ZONE,
        hour: "numeric",
        minute: "2-digit",
        timeZoneName: "short"
    });

    function updateClock() {
        const now = new Date();

        const dateText = dateFormatter.format(now);
        const timeText = timeFormatter.format(now);

        clockElement.textContent =
            `${dateText} • ${timeText}`;
    }

    updateClock();

    window.setInterval(updateClock, 1000);
})();
