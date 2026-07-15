/*
 * Mario Mania Marathon 2027
 * Shared overlay functionality
 */

(function () {
    "use strict";

    function wait(milliseconds) {
        return new Promise((resolve) => {
            window.setTimeout(resolve, milliseconds);
        });
    }

    function formatCurrency(value, currency = "USD") {
        const number = Number(value);

        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(
            Number.isFinite(number)
                ? number
                : 0
        );
    }


    /*
     * ------------------------------------------------------------
     * EASTERN DATE AND TIME
     * ------------------------------------------------------------
     */

    const clockElement =
        document.getElementById(
            "event-clock"
        );

    const easternTimeZone =
        "America/New_York";

    const dateFormatter =
        new Intl.DateTimeFormat(
            "en-US",
            {
                timeZone:
                    easternTimeZone,

                year:
                    "numeric",

                month:
                    "numeric",

                day:
                    "numeric"
            }
        );

    const timeFormatter =
        new Intl.DateTimeFormat(
            "en-US",
            {
                timeZone:
                    easternTimeZone,

                hour:
                    "numeric",

                minute:
                    "2-digit",

                hour12:
                    true,

                timeZoneName:
                    "short"
            }
        );

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

        const now =
            new Date();

        const dateParts =
            dateFormatter.formatToParts(
                now
            );

        const timeParts =
            timeFormatter.formatToParts(
                now
            );

        const year =
            getPart(
                dateParts,
                "year"
            );

        const month =
            getPart(
                dateParts,
                "month"
            );

        const day =
            getPart(
                dateParts,
                "day"
            );

        const hour =
            getPart(
                timeParts,
                "hour"
            );

        const minute =
            getPart(
                timeParts,
                "minute"
            );

        const dayPeriod =
            getPart(
                timeParts,
                "dayPeriod"
            );

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

    const campaignWorkerUrl =
        "https://mario-mania-donations.kodychristian.workers.dev";

    const donationFallbackUrl =
        "../data/donations.json";

    const campaignRefreshInterval =
        15000;

    const donationTotalElement =
        document.getElementById(
            "donation-total"
        );

    let activePolls = [];

    async function fetchJson(url) {
        const separator =
            url.includes("?")
                ? "&"
                : "?";

        const response =
            await fetch(
                `${url}${separator}v=${Date.now()}`,
                {
                    cache:
                        "no-store"
                }
            );

        if (!response.ok) {
            throw new Error(
                `Request failed with status ${response.status}.`
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
                        poll.id ||
                        null,

                    name:
                        poll.name ||
                        "Unnamed bid war",

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

    function showDonationTotal(
        campaignData
    ) {
        if (!donationTotalElement) {
            return;
        }

        const total =
            Number(
                campaignData?.total
            );

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
                await fetchJson(
                    campaignWorkerUrl
                );

            showDonationTotal(
                campaignData
            );

            activePolls =
                normalizePolls(
                    campaignData.polls
                );
        } catch (workerError) {
            console.error(
                "Unable to load live Tiltify campaign data.",
                workerError
            );

            activePolls = [];

            try {
                const fallbackData =
                    await fetchJson(
                        donationFallbackUrl
                    );

                showDonationTotal(
                    fallbackData
                );
            } catch (fallbackError) {
                console.error(
                    "Unable to load fallback donation data.",
                    fallbackError
                );
            }
        }
    }


    /*
     * ------------------------------------------------------------
     * IMAGE AND BID-WAR ROTATOR
     * ------------------------------------------------------------
     */

    const rotatorDataUrl =
        "../data/rotator.json";

    const bidWarCardDuration =
        10000;

    const bidWarInitialHold =
        3000;

    const bidWarFirstFadeDuration =
        450;

    const bidWarAfterFadeHold =
        200;

    const bidWarShiftDuration =
        650;

    const bidWarAfterShiftHold =
        150;

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
        document.body.dataset
            .rotatorSet ||
        "16x9";

    const rotatorImageBaseUrl =
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

    let bidWarAnimationVersion = 0;

    function cancelBidWarAnimation() {
        bidWarAnimationVersion += 1;
    }

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
            typeof slide.file ===
            "string"
                ? slide.file.trim()
                : "";

        if (fileName) {
            return (
                rotatorImageBaseUrl +
                fileName
            );
        }

        return (
            typeof slide.image ===
            "string"
                ? slide.image.trim()
                : ""
        );
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

        const source =
            resolveSlideSource(
                slide
            );

        if (!source) {
            console.error(
                "Rotator slide has no valid image source.",
                slide
            );

            return;
        }

        await hideRotatorContent(
            transitionDuration
        );

        try {
            await preloadImage(
                source
            );
        } catch (error) {
            console.error(
                `Unable to load rotator image: ${source}`,
                error
            );

            return;
        }

        rotatorImage.src =
            source;

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

    function createBidOption(
        option,
        index,
        currency
    ) {
        const optionElement =
            document.createElement(
                "div"
            );

        optionElement.className =
            "bid-option";

        if (index === 0) {
            optionElement.classList.add(
                "is-leading"
            );
        }

        const rankElement =
            document.createElement(
                "span"
            );

        rankElement.className =
            "bid-option-rank";

        rankElement.textContent =
            String(index + 1);

        const nameElement =
            document.createElement(
                "span"
            );

        nameElement.className =
            "bid-option-name";

        nameElement.textContent =
            option.name;

        const amountElement =
            document.createElement(
                "span"
            );

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

        incentiveFooter.textContent =
            "";

        /*
         * Only the top three options are shown.
         */

        const visibleOptions =
            poll.options.slice(
                0,
                3
            );

        const track =
            document.createElement(
                "div"
            );

        track.className =
            "bid-war-track";

        if (
            visibleOptions.length === 1
        ) {
            track.classList.add(
                "has-one-bid"
            );
        }

        if (
            visibleOptions.length === 3
        ) {
            track.classList.add(
                "has-third-bid"
            );
        }

        const optionElements =
            visibleOptions.map((
                option,
                index
            ) => {
                return createBidOption(
                    option,
                    index,
                    poll.currency
                );
            });

        track.append(
            ...optionElements
        );

        incentiveOptions.replaceChildren(
            track
        );

        return track;
    }

    async function animateBidWarTrack(
        track
    ) {
        if (
            !track.classList.contains(
                "has-third-bid"
            )
        ) {
            return;
        }

        const animationVersion =
            ++bidWarAnimationVersion;

        await wait(
            bidWarInitialHold
        );

        if (
            animationVersion !==
                bidWarAnimationVersion ||
            incentiveCard.hidden
        ) {
            return;
        }

        /*
         * Fade first place.
         */

        track.classList.add(
            "is-first-faded"
        );

        await wait(
            bidWarFirstFadeDuration +
            bidWarAfterFadeHold
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
            bidWarShiftDuration +
            bidWarAfterShiftHold
        );

        if (
            animationVersion !==
                bidWarAnimationVersion ||
            incentiveCard.hidden
        ) {
            return;
        }

        /*
         * Fade third place into the second slot.
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
            paintBidWarCard(
                poll
            );

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

    function buildRotatorItems(
        slides
    ) {
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
                        bidWarCardDuration,

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
            const configuration =
                await fetchJson(
                    rotatorDataUrl
                );

            if (
                Array.isArray(
                    configuration.slides
                ) &&
                configuration.slides
                    .length > 0
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
                "Unable to load rotator.json. Using the fallback slide.",
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

        let currentItemIndex = 0;

        while (true) {
            const items =
                buildRotatorItems(
                    slides
                );

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
                currentItemIndex = 0;
            }

            const currentItem =
                items[
                    currentItemIndex
                ];

            await displayRotatorItem(
                currentItem,
                transitionDuration
            );

            const duration =
                Number.isFinite(
                    currentItem.duration
                )
                    ? currentItem.duration
                    : defaultDuration;

            await wait(
                duration
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
            startRotator()
                .catch((error) => {
                    console.error(
                        "Rotator failed to start.",
                        error
                    );
                });
        });

    window.setInterval(
        refreshCampaignData,
        campaignRefreshInterval
    );
})();
