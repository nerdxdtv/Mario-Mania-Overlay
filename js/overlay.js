/*
 * Mario Mania Marathon 2027
 * Shared overlay functionality
 *
 * This file controls:
 * - Eastern date and time
 * - Informational image and Tiltify poll rotator
 * - Tiltify donation total
 *
 * Schedule and message-bar functionality belongs only in:
 * js/schedule-2027.js
 */

(function () {
    "use strict";

    /*
     * ------------------------------------------------------------
     * SHARED HELPERS
     * ------------------------------------------------------------
     */

    function wait(milliseconds) {
        return new Promise((resolve) => {
            window.setTimeout(resolve, milliseconds);
        });
    }

    function formatCurrency(value, currency) {
        const numericValue = Number(value);

        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency: currency || "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(
            Number.isFinite(numericValue)
                ? numericValue
                : 0
        );
    }

    /*
     * ------------------------------------------------------------
     * EASTERN DATE AND TIME
     * ------------------------------------------------------------
     */

    const EASTERN_TIME_ZONE =
        "America/New_York";

    const clockElement =
        document.getElementById("event-clock");

    const dateFormatter =
        new Intl.DateTimeFormat("en-US", {
            timeZone: EASTERN_TIME_ZONE,
            year: "numeric",
            month: "numeric",
            day: "numeric"
        });

    const timeFormatter =
        new Intl.DateTimeFormat("en-US", {
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

        return matchingPart
            ? matchingPart.value
            : "";
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

        const year =
            getPart(dateParts, "year");

        const month =
            getPart(dateParts, "month");

        const day =
            getPart(dateParts, "day");

        const hour =
            getPart(timeParts, "hour");

        const minute =
            getPart(timeParts, "minute");

        const dayPeriod =
            getPart(timeParts, "dayPeriod");

        const timeZone =
            getPart(timeParts, "timeZoneName");

        clockElement.textContent =
            `${year}-${month}-${day} ` +
            `${hour}:${minute} ` +
            `${dayPeriod} ${timeZone}`;
    }

    /*
     * ------------------------------------------------------------
     * LIVE TILTIFY CAMPAIGN DATA
     * ------------------------------------------------------------
     */

    const CAMPAIGN_WORKER_URL =
        "https://mario-mania-donations.kodychristian.workers.dev";

    const DONATION_FALLBACK_URL =
        "../data/donations.json";

    const CAMPAIGN_REFRESH_INTERVAL =
        15000;

    const donationTotalElement =
        document.getElementById(
            "donation-total"
        );

    let activePolls = [];

    async function fetchJsonData(url) {
        const separator =
            url.includes("?") ? "&" : "?";

        const cacheBuster =
            Date.now();

        const response = await fetch(
            `${url}${separator}v=${cacheBuster}`,
            {
                cache: "no-store"
            }
        );

        if (!response.ok) {
            throw new Error(
                `Campaign request returned status ${response.status}.`
            );
        }

        return response.json();
    }

    function normalizePolls(polls) {
        if (!Array.isArray(polls)) {
            return [];
        }

        return polls
            .filter((poll) => {
                return (
                    poll &&
                    poll.active === true
                );
            })
            .map((poll) => {
                const options =
                    Array.isArray(poll.options)
                        ? poll.options
                            .map((
                                option,
                                originalIndex
                            ) => {
                                return {
                                    id:
                                        option?.id ||
                                        null,

                                    name:
                                        option?.name ||
                                        "Unnamed option",

                                    amountRaised:
                                        Number(
                                            option
                                                ?.amountRaised
                                        ) || 0,

                                    originalIndex
                                };
                            })
                            .sort((
                                first,
                                second
                            ) => {
                                const amountDifference =
                                    second
                                        .amountRaised -
                                    first
                                        .amountRaised;

                                if (
                                    amountDifference !==
                                    0
                                ) {
                                    return (
                                        amountDifference
                                    );
                                }

                                return (
                                    first
                                        .originalIndex -
                                    second
                                        .originalIndex
                                );
                            })
                            .map(({
                                originalIndex,
                                ...option
                            }) => {
                                return option;
                            })
                        : [];

                return {
                    id:
                        poll.id || null,

                    name:
                        poll.name ||
                        "Unnamed poll",

                    active: true,

                    amountRaised:
                        Number(
                            poll.amountRaised
                        ) || 0,

                    currency:
                        poll.currency ||
                        "USD",

                    options
                };
            })
            .filter((poll) => {
                return (
                    poll.options.length > 0
                );
            });
    }

    function paintDonationTotal(
        campaignData
    ) {
        if (!donationTotalElement) {
            return;
        }

        const total =
            Number(campaignData?.total);

        if (!Number.isFinite(total)) {
            throw new Error(
                "Donation total is missing or invalid."
            );
        }

        donationTotalElement.textContent =
            formatCurrency(
                total,
                campaignData.currency ||
                    "USD"
            );
    }

    async function refreshCampaignData() {
        try {
            const campaignData =
                await fetchJsonData(
                    CAMPAIGN_WORKER_URL
                );

            paintDonationTotal(
                campaignData
            );

            activePolls =
                normalizePolls(
                    campaignData.polls
                );
        } catch (workerError) {
            console.error(
                "Unable to load live Tiltify " +
                "campaign data. Trying the " +
                "local donation fallback.",
                workerError
            );

            activePolls = [];

            try {
                const fallbackData =
                    await fetchJsonData(
                        DONATION_FALLBACK_URL
                    );

                paintDonationTotal(
                    fallbackData
                );
            } catch (fallbackError) {
                console.error(
                    "Unable to load fallback " +
                    "donation total.",
                    fallbackError
                );
            }
        }
    }

    /*
     * ------------------------------------------------------------
     * INFORMATIONAL IMAGE AND POLL ROTATOR
     * ------------------------------------------------------------
     */

    const ROTATOR_DATA_URL =
        "../data/rotator.json";

    const POLL_CARD_DURATION =
        10000;

    const rotatorImage =
        document.getElementById(
            "rotator-image"
        );

    const incentiveCard =
        document.getElementById(
            "incentive-card"
        );

    const incentiveLabel =
        document.getElementById(
            "incentive-label"
        );

    const incentiveTitle =
        document.getElementById(
            "incentive-title"
        );

    const incentiveOptions =
        document.getElementById(
            "incentive-options"
        );

    const incentiveFooter =
        document.getElementById(
            "incentive-footer"
        );

    const supportsIncentiveCards =
        Boolean(
            incentiveCard &&
            incentiveLabel &&
            incentiveTitle &&
            incentiveOptions &&
            incentiveFooter
        );

    const rotatorSet =
        document.body.dataset.rotatorSet ||
        "16x9";

    const ROTATOR_IMAGE_BASE_URL =
        `../assets/rotator/${rotatorSet}/`;

    const fallbackSlides = [
        {
            file:
                "march-of-dimes.png",

            alt:
                "March of Dimes",

            duration:
                8000
        }
    ];

    function preloadImage(source) {
        return new Promise((
            resolve,
            reject
        ) => {
            const image =
                new Image();

            image.onload =
                resolve;

            image.onerror =
                reject;

            image.src =
                source;
        });
    }

    function resolveSlideSource(slide) {
        const fileName =
            typeof slide.file === "string"
                ? slide.file.trim()
                : "";

        if (fileName) {
            return (
                ROTATOR_IMAGE_BASE_URL +
                fileName
            );
        }

        /*
         * Temporary support for older
         * rotator.json entries that still
         * contain a complete "image" path.
         */

        const legacyImagePath =
            typeof slide.image === "string"
                ? slide.image.trim()
                : "";

        return legacyImagePath;
    }

    async function hideRotatorContent(
        transitionDuration
    ) {
        if (rotatorImage) {
            rotatorImage.classList.remove(
                "is-visible"
            );
        }

        if (incentiveCard) {
            incentiveCard.classList.remove(
                "is-visible"
            );
        }

        await wait(
            transitionDuration
        );

        if (incentiveCard) {
            incentiveCard.hidden =
                true;
        }
    }

    async function displayImageSlide(
        slide,
        transitionDuration
    ) {
        if (!rotatorImage) {
            return;
        }

        const slideSource =
            resolveSlideSource(slide);

        if (!slideSource) {
            console.error(
                "Rotator slide has no " +
                "valid filename.",
                slide
            );

            return;
        }

        await hideRotatorContent(
            transitionDuration
        );

        try {
            await preloadImage(
                slideSource
            );
        } catch (error) {
            console.error(
                `Unable to load rotator image: ${slideSource}`,
                error
            );

            return;
        }

        rotatorImage.src =
            slideSource;

        rotatorImage.alt =
            slide.alt || "";

        window.requestAnimationFrame(
            () => {
                rotatorImage.classList.add(
                    "is-visible"
                );
            }
        );
    }

    function createPollOptionElement(
        option,
        index,
        currency
    ) {
        const optionElement =
            document.createElement("div");

        optionElement.className =
            "incentive-option";

        if (index === 0) {
            optionElement.classList.add(
                "is-leading"
            );
        }

        const rankElement =
            document.createElement("span");

        rankElement.className =
            "incentive-option-rank";

        rankElement.textContent =
            String(index + 1);

        const nameElement =
            document.createElement("span");

        nameElement.className =
            "incentive-option-name";

        nameElement.textContent =
            option.name;

        const amountElement =
            document.createElement("span");

        amountElement.className =
            "incentive-option-amount";

        amountElement.textContent =
            formatCurrency(
                option.amountRaised,
                currency
            );

        optionElement.appendChild(
            rankElement
        );

        optionElement.appendChild(
            nameElement
        );

        optionElement.appendChild(
            amountElement
        );

        return optionElement;
    }

    function paintPollCard(poll) {
        incentiveLabel.textContent =
            "DONATION POLL";

        incentiveTitle.textContent =
            poll.name;

        const optionElements =
            poll.options.map((
                option,
                index
            ) => {
                return (
                    createPollOptionElement(
                        option,
                        index,
                        poll.currency
                    )
                );
            });

        incentiveOptions.replaceChildren(
            ...optionElements
        );

        incentiveFooter.textContent =
            `${formatCurrency(
                poll.amountRaised,
                poll.currency
            )} DONATED`;

        incentiveCard.classList.toggle(
            "has-four-options",
            poll.options.length >= 4
        );
    }

    async function displayPollCard(
        poll,
        transitionDuration
    ) {
        if (!supportsIncentiveCards) {
            return;
        }

        await hideRotatorContent(
            transitionDuration
        );

        paintPollCard(poll);

        incentiveCard.hidden =
            false;

        window.requestAnimationFrame(
            () => {
                incentiveCard.classList.add(
                    "is-visible"
                );
            }
        );
    }

    function buildRotatorItems(slides) {
        const imageItems =
            slides.map((slide) => {
                return {
                    type:
                        "image",

                    duration:
                        Number.isFinite(
                            slide.duration
                        )
                            ? slide.duration
                            : null,

                    slide
                };
            });

        if (!supportsIncentiveCards) {
            return imageItems;
        }

        const pollItems =
            activePolls.map((poll) => {
                return {
                    type:
                        "poll",

                    duration:
                        POLL_CARD_DURATION,

                    poll
                };
            });

        return imageItems.concat(
            pollItems
        );
    }

    async function displayRotatorItem(
        item,
        transitionDuration
    ) {
        if (item.type === "poll") {
            await displayPollCard(
                item.poll,
                transitionDuration
            );

            return;
        }

        await displayImageSlide(
            item.slide,
            transitionDuration
        );
    }

    async function loadRotatorConfiguration() {
        let slides =
            fallbackSlides;

        let defaultDuration =
            8000;

        let transitionDuration =
            700;

        try {
            const response =
                await fetch(
                    `${ROTATOR_DATA_URL}?t=${Date.now()}`,
                    {
                        cache: "no-store"
                    }
                );

            if (!response.ok) {
                throw new Error(
                    `Rotator data returned status ${response.status}.`
                );
            }

            const configuration =
                await response.json();

            if (
                Array.isArray(
                    configuration.slides
                ) &&
                configuration.slides.length > 0
            ) {
                slides =
                    configuration.slides;
            }

            if (
                Number.isFinite(
                    configuration
                        .defaultDuration
                )
            ) {
                defaultDuration =
                    configuration
                        .defaultDuration;
            }

            if (
                Number.isFinite(
                    configuration
                        .transitionDuration
                )
            ) {
                transitionDuration =
                    configuration
                        .transitionDuration;
            }
        } catch (error) {
            console.error(
                "Unable to load rotator.json. " +
                "Using the fallback slide.",
                error
            );
        }

        return {
            slides,
            defaultDuration,
            transitionDuration
        };
    }

    async function startRotator() {
        if (!rotatorImage) {
            return;
        }

        const configuration =
            await loadRotatorConfiguration();

        const {
            slides,
            defaultDuration,
            transitionDuration
        } = configuration;

        rotatorImage.style
            .transitionDuration =
            `${transitionDuration}ms`;

        if (incentiveCard) {
            incentiveCard.style
                .transitionDuration =
                `${transitionDuration}ms`;
        }

        let currentItemIndex =
            0;

        while (true) {
            const items =
                buildRotatorItems(slides);

            if (items.length === 0) {
                await wait(
                    defaultDuration
                );

                continue;
            }

            if (
                currentItemIndex >=
                items.length
            ) {
                currentItemIndex =
                    0;
            }

            const currentItem =
                items[currentItemIndex];

            await displayRotatorItem(
                currentItem,
                transitionDuration
            );

            const itemDuration =
                Number.isFinite(
                    currentItem.duration
                )
                    ? currentItem.duration
                    : defaultDuration;

            await wait(
                itemDuration
            );

            currentItemIndex =
                (
                    currentItemIndex + 1
                ) % items.length;
        }
    }

    /*
     * ------------------------------------------------------------
     * START THE OVERLAY
     * ------------------------------------------------------------
     */

    updateClock();

    window.setInterval(
        updateClock,
        1000
    );

    refreshCampaignData()
        .catch((error) => {
            console.error(
                "Initial campaign refresh failed.",
                error
            );
        })
        .finally(() => {
            startRotator();
        });

    window.setInterval(
        refreshCampaignData,
        CAMPAIGN_REFRESH_INTERVAL
    );
})();
