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

    function clamp(value, minimum, maximum) {
        return Math.min(
            Math.max(value, minimum),
            maximum
        );
    }

    function easeInOutCubic(progress) {
        return progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;
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
    let nextMilestone = null;

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

    function findNextMilestone(
        milestones,
        campaignTotal,
        fallbackCurrency
    ) {
        if (!Array.isArray(milestones)) {
            return null;
        }

        const normalizedMilestones =
            milestones
                .filter((milestone) => {
                    return (
                        milestone &&
                        milestone.active === true
                    );
                })
                .map((milestone) => {
                    return {
                        id:
                            milestone.id ||
                            null,

                        name:
                            milestone.name ||
                            "Unnamed milestone",

                        amount:
                            Number(
                                milestone.amount
                            ),

                        currency:
                            milestone.currency ||
                            fallbackCurrency ||
                            "USD"
                    };
                })
                .filter((milestone) => {
                    return (
                        Number.isFinite(
                            milestone.amount
                        ) &&
                        milestone.amount >
                            campaignTotal
                    );
                })
                .sort((first, second) => {
                    return (
                        first.amount -
                        second.amount
                    );
                });

        if (
            normalizedMilestones.length === 0
        ) {
            return null;
        }

        return {
            ...normalizedMilestones[0],

            currentAmount:
                campaignTotal
        };
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

            const campaignTotal =
                Number(
                    campaignData?.total
                );

            if (!Number.isFinite(campaignTotal)) {
                throw new Error(
                    "Campaign total is missing or invalid."
                );
            }

            showDonationTotal(
                campaignData
            );

            activePolls =
                normalizePolls(
                    campaignData.polls
                );

            nextMilestone =
                findNextMilestone(
                    campaignData.milestones,
                    campaignTotal,
                    campaignData.currency ||
                        "USD"
                );
        } catch (workerError) {
            console.error(
                "Unable to load live Tiltify campaign data.",
                workerError
            );

            activePolls = [];
            nextMilestone = null;

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
     * IMAGE, BID-WAR, AND MILESTONE ROTATOR
     * ------------------------------------------------------------
     */

    const rotatorDataUrl =
        "../data/rotator.json";

    const bidWarCardDuration =
        10000;

    const milestoneCardDuration =
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

    const milestoneInitialHold =
        700;

    const milestoneFillDuration =
        2400;

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

    let cardAnimationVersion = 0;

    function cancelCardAnimation() {
        cardAnimationVersion += 1;
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

    function resetIncentiveCardClasses() {
        if (!incentiveCard) {
            return;
        }

        incentiveCard.classList.remove(
            "is-milestone"
        );

        const existingMilestoneDisplay =
            incentiveCard.querySelector(
                ".milestone-display"
            );

        if (existingMilestoneDisplay) {
            existingMilestoneDisplay.remove();
        }
    }

    async function hideRotatorContent(
        transitionDuration
    ) {
        cancelCardAnimation();

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

            resetIncentiveCardClasses();
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
        resetIncentiveCardClasses();

        incentiveLabel.textContent =
            "BID WAR";

        incentiveTitle.textContent =
            poll.name;

        incentiveFooter.textContent =
            "";

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
            ++cardAnimationVersion;

        await wait(
            bidWarInitialHold
        );

        if (
            animationVersion !==
                cardAnimationVersion ||
            incentiveCard.hidden
        ) {
            return;
        }

        track.classList.add(
            "is-first-faded"
        );

        await wait(
            bidWarFirstFadeDuration +
            bidWarAfterFadeHold
        );

        if (
            animationVersion !==
                cardAnimationVersion ||
            incentiveCard.hidden
        ) {
            return;
        }

        track.classList.add(
            "is-shifted"
        );

        await wait(
            bidWarShiftDuration +
            bidWarAfterShiftHold
        );

        if (
            animationVersion !==
                cardAnimationVersion ||
            incentiveCard.hidden
        ) {
            return;
        }

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

    function paintMilestoneCard(
        milestone
    ) {
        resetIncentiveCardClasses();

        incentiveCard.classList.add(
            "is-milestone"
        );

        incentiveLabel.textContent =
            "NEXT MILESTONE";

        incentiveTitle.textContent =
            milestone.name;

        incentiveFooter.textContent =
            "";

        const goalAmount =
            Number(
                milestone.amount
            );

        const currentAmount =
            Number(
                milestone.currentAmount
            );

        const progress =
            goalAmount > 0
                ? clamp(
                    currentAmount /
                        goalAmount,
                    0,
                    1
                )
                : 0;

        const display =
            document.createElement(
                "div"
            );

        display.className =
            "milestone-display";

        const amounts =
            document.createElement(
                "div"
            );

        amounts.className =
            "milestone-amounts";

        const current =
            document.createElement(
                "span"
            );

        current.className =
            "milestone-current";

        current.textContent =
            `${formatCurrency(
                0,
                milestone.currency
            )} RAISED`;

        const goal =
            document.createElement(
                "span"
            );

        goal.className =
            "milestone-goal";

        goal.textContent =
            `${formatCurrency(
                goalAmount,
                milestone.currency
            )} GOAL`;

        amounts.append(
            current,
            goal
        );

        const progressTrack =
            document.createElement(
                "div"
            );

        progressTrack.className =
            "milestone-progress-track";

        const progressFill =
            document.createElement(
                "div"
            );

        progressFill.className =
            "milestone-progress-fill";

        progressFill.style.width =
            "0%";

        const percentage =
            document.createElement(
                "div"
            );

        percentage.className =
            "milestone-percentage";

        percentage.textContent =
            "0%";

        progressTrack.append(
            progressFill,
            percentage
        );

        display.append(
            amounts,
            progressTrack
        );

        incentiveOptions.replaceChildren();

        incentiveCard.appendChild(
            display
        );

        return {
            current,
            progressFill,
            percentage,
            progress,
            currentAmount,

            currency:
                milestone.currency
        };
    }

    function animateMilestoneNumbers(
        elements,
        animationVersion
    ) {
        const startTime =
            performance.now();

        function paintFrame(now) {
            if (
                animationVersion !==
                    cardAnimationVersion ||
                incentiveCard.hidden
            ) {
                return;
            }

            const elapsed =
                now - startTime;

            const rawProgress =
                clamp(
                    elapsed /
                        milestoneFillDuration,
                    0,
                    1
                );

            const easedProgress =
                easeInOutCubic(
                    rawProgress
                );

            const animatedAmount =
                elements.currentAmount *
                easedProgress;

            const animatedPercentage =
                elements.progress *
                easedProgress *
                100;

            elements.current.textContent =
                `${formatCurrency(
                    animatedAmount,
                    elements.currency
                )} RAISED`;

            elements.percentage.textContent =
                `${Math.round(
                    animatedPercentage
                )}%`;

            if (rawProgress < 1) {
                window.requestAnimationFrame(
                    paintFrame
                );

                return;
            }

            elements.current.textContent =
                `${formatCurrency(
                    elements.currentAmount,
                    elements.currency
                )} RAISED`;

            elements.percentage.textContent =
                `${(
                    elements.progress *
                    100
                ).toFixed(1)}%`;
        }

        window.requestAnimationFrame(
            paintFrame
        );
    }

    async function animateMilestoneCard(
        elements
    ) {
        const animationVersion =
            ++cardAnimationVersion;

        await wait(
            milestoneInitialHold
        );

        if (
            animationVersion !==
                cardAnimationVersion ||
            incentiveCard.hidden
        ) {
            return;
        }

        elements.progressFill.style.width =
            `${(
                elements.progress *
                100
            ).toFixed(2)}%`;

        animateMilestoneNumbers(
            elements,
            animationVersion
        );
    }

    async function displayMilestoneCard(
        milestone,
        transitionDuration
    ) {
        if (!supportsIncentiveCards) {
            return;
        }

        await hideRotatorContent(
            transitionDuration
        );

        const elements =
            paintMilestoneCard(
                milestone
            );

        incentiveCard.hidden =
            false;

        window.requestAnimationFrame(
            () => {
                incentiveCard.classList.add(
                    "is-visible"
                );

                animateMilestoneCard(
                    elements
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

        const milestoneItems =
            nextMilestone
                ? [
                    {
                        type:
                            "milestone",

                        duration:
                            milestoneCardDuration,

                        milestone:
                            nextMilestone
                    }
                ]
                : [];

        return imageItems.concat(
            bidWarItems,
            milestoneItems
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

        if (item.type === "milestone") {
            await displayMilestoneCard(
                item.milestone,
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
