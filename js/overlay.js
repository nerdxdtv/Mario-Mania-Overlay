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
})();
