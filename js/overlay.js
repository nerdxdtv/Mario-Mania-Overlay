/*
 * Mario Mania Marathon 2027
 * Shared overlay functionality
 *
 * This file controls:
 * - Eastern date and time
 * - Informational image and Tiltify bid-war rotator
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
        const matchingPart =
            parts.find((part) => {
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
            getPart(
                timeParts,
                "timeZoneName"
            );

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
                    Array.isArray(
                        poll.options
                    )
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
                        "Unnamed bid war",

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
     * INFORMATIONAL IMAGE AND BID-WAR ROTATOR
     * ------------------------------------------------------------
     */

    const ROTATOR_DATA_URL =
        "../data/rotator.json";

    const BID_WAR_CARD_DURATION =
        10000;

    /*
     * Bid-war animation timing.
     *
     * First:
     * 1st and 2nd place appear together.
     *
     * Then:
     * 1st place fades.
     * 2nd place slides into the first position.
     * 3rd place fades into the second position.
     */

    const BID_WAR_INITIAL_HOLD =
        3000;

    const BID_WAR_AFTER_FADE_HOLD =
        200;

    const BID_WAR_AFTER_SHIFT_HOLD =
        150;

    const BID_WAR_FIRST_FADE_DURATION =
        450;

    const BID_WAR_SHIFT_DURATION =
        650;

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

    /*
     * Increasing this value cancels any bid-war
     * animation that is currently in progress.
     */

    let bidWarAnimationVersion = 0;

    function cancelBidWarAnimation() {
        bidWarAnimationVersion += 1;
    }

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
         * rotator.json entries that contain
         * a complete image path.
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
        cancelBidWarAnimation();

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

        await hideRotatoris-visible"
            );
        }

        await wait(
            transitionDuration
        );

Content(
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

    function createBidOptionElement(
        option,
        index,
        currency
    ) {
        const optionElement =
            document.createElement("div");

        optionElement.className =
            "bid-option";

        if (index === 0) {
            optionElement.classList.add(
                "is-leading"
            );
        }

        const rankElement =
            document.createElement("span");

        rankElement.className =
            "bid-option-rank";

        rankElement.textContent =
            String(index + 1);

        const nameElement =
            document.createElement("span");

        nameElement.className =
            "bid-option-name";

        nameElement.textContent =
            option.name;

        const amountElement =
            document.createElement("span");

        amountElement.className =
            "bid-option-amount";

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

    function paintBidWarCard(poll) {
        incentiveLabel.textContent =
            "BID WAR";

        incentiveTitle.textContent =
            poll.name;

        /*
         * Only the top three options matter for
         * this presentation.
         *
         * Fourth place and below are intentionally
         * omitted from the rotator card.
         */

        const visibleOptions =
            poll.options.slice(0, 3);

        const track =
            document.createElement("div");

        track.className =
            "bid-war-track";

        if (visibleOptions.length === 1) {
            track.classList.add(
                "has-one-bid"
            );
        }

        if (visibleOptions.length >= 3) {
            track.classList.add(
                "has-third-bid"
            );
        }

        const optionElements =
            visibleOptions.map((
                option,
                index
            ) => {
                return (
                    createBidOptionElement(
                        option,
                        index,
                        poll.currency
                    )
                );
            });

        track.append(
            ...optionElements
        );

        incentiveOptions.replaceChildren(
            track
        );

        /*
         * The combined poll total is intentionally
         * not displayed.
         */

        incentiveFooter.textContent =
            "";

        return track;
    }

    async function animateBidWarTrack(
        track
    ) {
        if (
            !track ||
            !track.classList.contains(
                "has-third-bid"
            )
        ) {
            return;
        }

        const animationVersion =
            ++bidWarAnimationVersion;

        await wait(
            BID_WAR_INITIAL_HOLD
        );

        if (
            animationVersion !==
                bidWarAnimationVersion ||
            incentiveCard.hidden
        ) {
            return;
        }

        /*
         * Fade the first-place option.
         */

        track.classList.add(
            "is-first-faded"
        );

        await wait(
            BID_WAR_FIRST_FADE_DURATION +
            BID_WAR_AFTER_FADE_HOLD
        );

        if (
            animationVersion !==
                bidWarAnimationVersion ||
            incentiveCard.hidden
        ) {
            return;
        }

        /*
         * Move second place into the first slot.
         */

        track.classList.add(
            "is-shifted"
        );

        await wait(
            BID_WAR_SHIFT_DURATION +
            BID_WAR_AFTER_SHIFT_HOLD
        );

        if (
            animationVersion !==
                bidWarAnimationVersion ||
            incentiveCard.hidden
        ) {
            return;
        }

        /*
         * Fade third place into the newly opened
         * second slot.
         */

        track.classList.add(
            "is-third-visible"
        );
    }

    async function displayBidWarCard(
        poll,
        transitionDuration
    ) {
        if (!supportsIncentiveCards) {
            return;
        }

        await hideRotatorContent(
            transitionDuration
        );

        const track =
            paintBidWarCard(poll);

        incentiveCard.hidden =
            false;

        window.requestAnimationFrame(
            () => {
                incentiveCard.classList.add(
                    "is-visible"
                );

                animateBidWarTrack(
                    track
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

        const bidWarItems =
            activePolls.map((poll) => {
                return {
                    type:
                        "bid-war",

                    duration:
                        BID_WAR_CARD_DURATION,

                    poll
                };
            });

        return imageItems.concat(
            bidWarItems
        );
    }

    async function displayRotatorItem(
        item,
        transitionDuration
    ) {
        if (item.type === "bid-war") {
            await displayBidWarCard(
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
