/*
 * Mario Mania Marathon 2027
 * Shared overlay functionality
 *
 * Controls:
 * - Eastern date and time
 * - Tiltify donation total
 * - Image rotator
 * - Up to three active bid wars
 * - Nearest unmet milestone
 * - One-time poll and milestone announcements
 */

(() => {
    "use strict";

    /*
     * ------------------------------------------------------------
     * GENERAL HELPERS
     * ------------------------------------------------------------
     */

    const wait = (milliseconds) =>
        new Promise((resolve) => {
            window.setTimeout(resolve, milliseconds);
        });

    const clamp = (value, minimum, maximum) =>
        Math.min(Math.max(value, minimum), maximum);

    const easeInOutCubic = (progress) =>
        progress < 0.5
            ? 4 * progress * progress * progress
            : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    const formatCurrency = (value, currency = "USD") => {
        const numericValue = Number(value);

        return new Intl.NumberFormat("en-US", {
            style: "currency",
            currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(
            Number.isFinite(numericValue)
                ? numericValue
                : 0
        );
    };

    const shuffle = (items) => {
        const copy = [...items];

        for (
            let index = copy.length - 1;
            index > 0;
            index -= 1
        ) {
            const randomIndex =
                Math.floor(
                    Math.random() * (index + 1)
                );

            [
                copy[index],
                copy[randomIndex]
            ] = [
                copy[randomIndex],
                copy[index]
            ];
        }

        return copy;
    };


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

    const getPart = (parts, type) => {
        const matchingPart =
            parts.find((part) => {
                return part.type === type;
            });

        return matchingPart
            ? matchingPart.value
            : "";
    };

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
     * CONFIGURATION
     * ------------------------------------------------------------
     */

    const campaignWorkerUrl =
        "https://mario-mania-donations.kodychristian.workers.dev";

    const donationFallbackUrl =
        "../data/donations.json";

    const rotatorDataUrl =
        "../data/rotator.json";

    const campaignRefreshInterval =
        15000;

    const maximumSelectedPolls =
        3;

    const bidWarCardDuration =
        10000;

    const milestoneCardDuration =
        10000;

    const announcementCardDuration =
        8000;

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


    /*
     * ------------------------------------------------------------
     * PERSISTENT INCENTIVE STATE
     * ------------------------------------------------------------
     *
     * Each OBS Browser Source keeps its own copy.
     * First load creates a baseline without announcements.
     */

    const incentiveStateStorageKey =
        "marioManiaIncentiveStateV2";

    const createEmptyState = () => ({
        version:
            2,

        initialized:
            false,

        pollStates:
            {},

        milestoneStates:
            {},

        selectedPollIds:
            [],

        pendingEvents:
            [],

        lastCampaignTotal:
            null
    });

    function loadState() {
        try {
            const rawState =
                window.localStorage.getItem(
                    incentiveStateStorageKey
                );

            if (!rawState) {
                return createEmptyState();
            }

            const parsedState =
                JSON.parse(rawState);

            if (
                !parsedState ||
                parsedState.version !== 2
            ) {
                return createEmptyState();
            }

            return {
                ...createEmptyState(),
                ...parsedState,

                pollStates:
                    parsedState.pollStates &&
                    typeof parsedState.pollStates ===
                        "object"
                        ? parsedState.pollStates
                        : {},

                milestoneStates:
                    parsedState.milestoneStates &&
                    typeof parsedState
                        .milestoneStates ===
                        "object"
                        ? parsedState
                            .milestoneStates
                        : {},

                selectedPollIds:
                    Array.isArray(
                        parsedState.selectedPollIds
                    )
                        ? parsedState
                            .selectedPollIds
                        : [],

                pendingEvents:
                    Array.isArray(
                        parsedState.pendingEvents
                    )
                        ? parsedState
                            .pendingEvents
                        : []
            };
        } catch (error) {
            console.error(
                "Unable to read saved incentive state.",
                error
            );

            return createEmptyState();
        }
    }

    let incentiveState =
        loadState();

    function saveState() {
        try {
            window.localStorage.setItem(
                incentiveStateStorageKey,
                JSON.stringify(
                    incentiveState
                )
            );
        } catch (error) {
            console.error(
                "Unable to save incentive state.",
                error
            );
        }
    }

    function createEventId(
        prefix,
        sourceId
    ) {
        return (
            `${prefix}:${sourceId}:` +
            `${Date.now()}:` +
            `${Math.random()
                .toString(36)
                .slice(2, 8)}`
        );
    }

    function queueEvent(event) {
        const duplicate =
            incentiveState
                .pendingEvents
                .some((queuedEvent) => {
                    return (
                        queuedEvent.eventKey ===
                        event.eventKey
                    );
                });

        if (!duplicate) {
            incentiveState
                .pendingEvents
                .push(event);
        }
    }

    function completeQueuedEvent(
        eventId
    ) {
        incentiveState.pendingEvents =
            incentiveState
                .pendingEvents
                .filter((event) => {
                    return (
                        event.id !== eventId
                    );
                });

        saveState();
    }


    /*
     * ------------------------------------------------------------
     * LIVE CAMPAIGN DATA
     * ------------------------------------------------------------
     */

    const donationTotalElement =
        document.getElementById(
            "donation-total"
        );

    let allPolls = [];
    let activePolls = [];
    let selectedActivePolls = [];
    let allMilestones = [];
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
            .filter(Boolean)
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
                                const difference =
                                    second
                                        .amountRaised -
                                    first
                                        .amountRaised;

                                if (
                                    difference !== 0
                                ) {
                                    return difference;
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

                    active:
                        poll.active ===
                        true,

                    currency:
                        poll.currency ||
                        "USD",

                    amountRaised:
                        Number(
                            poll.amountRaised
                        ) || 0,

                    options
                };
            })
            .filter((poll) => {
                return (
                    poll.id &&
                    poll.options.length > 0
                );
            });
    }

    function normalizeMilestones(
        milestones,
        fallbackCurrency
    ) {
        if (!Array.isArray(milestones)) {
            return [];
        }

        return milestones
            .filter(Boolean)
            .map((milestone) => {
                return {
                    id:
                        milestone.id ||
                        null,

                    name:
                        milestone.name ||
                        "Unnamed milestone",

                    active:
                        milestone.active ===
                        true,

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
                    milestone.id &&
                    Number.isFinite(
                        milestone.amount
                    )
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

    function shouldResetForNewCampaign(
        polls,
        milestones
    ) {
        if (!incentiveState.initialized) {
            return false;
        }

        const storedIds =
            new Set([
                ...Object.keys(
                    incentiveState.pollStates
                ),

                ...Object.keys(
                    incentiveState
                        .milestoneStates
                )
            ]);

        const currentIds = [
            ...polls.map((poll) => {
                return poll.id;
            }),

            ...milestones.map(
                (milestone) => {
                    return milestone.id;
                }
            )
        ];

        if (
            storedIds.size === 0 ||
            currentIds.length === 0
        ) {
            return false;
        }

        return !currentIds.some((id) => {
            return storedIds.has(id);
        });
    }

    function chooseInitialPollSelection(
        currentlyActivePolls
    ) {
        return shuffle(
            currentlyActivePolls.map(
                (poll) => {
                    return poll.id;
                }
            )
        ).slice(
            0,
            maximumSelectedPolls
        );
    }

    function fillOpenPollSlots(
        selectedIds,
        currentlyActivePolls
    ) {
        const activeIds =
            new Set(
                currentlyActivePolls.map(
                    (poll) => {
                        return poll.id;
                    }
                )
            );

        const cleanedSelection =
            selectedIds.filter((
                id,
                index
            ) => {
                return (
                    activeIds.has(id) &&
                    selectedIds.indexOf(id) ===
                        index
                );
            });

        const availableIds =
            shuffle(
                currentlyActivePolls
                    .map((poll) => {
                        return poll.id;
                    })
                    .filter((id) => {
                        return !cleanedSelection
                            .includes(id);
                    })
            );

        while (
            cleanedSelection.length <
                maximumSelectedPolls &&
            availableIds.length > 0
        ) {
            cleanedSelection.push(
                availableIds.shift()
            );
        }

        return cleanedSelection.slice(
            0,
            maximumSelectedPolls
        );
    }

    function promotePollIntoSelection(
        selectedIds,
        pollId,
        currentlyActivePolls
    ) {
        const updatedSelection =
            selectedIds.filter((id) => {
                return id !== pollId;
            });

        updatedSelection.unshift(
            pollId
        );

        if (
            updatedSelection.length >
            maximumSelectedPolls
        ) {
            const removalIndex =
                1 +
                Math.floor(
                    Math.random() *
                    (
                        updatedSelection.length -
                        1
                    )
                );

            updatedSelection.splice(
                removalIndex,
                1
            );
        }

        return fillOpenPollSlots(
            updatedSelection,
            currentlyActivePolls
        );
    }

    function getPollResult(poll) {
        const topAmount =
            poll.options[0]
                ?.amountRaised ||
            0;

        const winners =
            poll.options.filter((option) => {
                return (
                    option.amountRaised ===
                    topAmount
                );
            });

        if (topAmount <= 0) {
            return {
                primary:
                    "NO BIDS RECEIVED",

                secondary:
                    ""
            };
        }

        if (winners.length === 1) {
            const winner =
                winners[0];

            return {
                primary:
                    `WINNER: ${winner.name}`,

                secondary:
                    formatCurrency(
                        winner.amountRaised,
                        poll.currency
                    )
            };
        }

        return {
            primary:
                "TIED WINNERS",

            secondary:
                `${winners
                    .map((winner) => {
                        return winner.name;
                    })
                    .join(" / ")} — ` +
                `${formatCurrency(
                    topAmount,
                    poll.currency
                )} EACH`
        };
    }

    function queuePollOpenedEvents(
        poll
    ) {
        const activationToken =
            `${poll.id}:${Date.now()}`;

        queueEvent({
            id:
                createEventId(
                    "poll-open",
                    poll.id
                ),

            eventKey:
                `poll-open:${activationToken}`,

            type:
                "poll-open-announcement",

            payload: {
                pollId:
                    poll.id,

                name:
                    poll.name
            }
        });

        queueEvent({
            id:
                createEventId(
                    "poll-open-bid-war",
                    poll.id
                ),

            eventKey:
                `poll-open-bid-war:` +
                activationToken,

            type:
                "priority-bid-war",

            payload: {
                pollId:
                    poll.id
            }
        });
    }

    function queuePollClosedEvent(
        poll
    ) {
        const result =
            getPollResult(poll);

        queueEvent({
            id:
                createEventId(
                    "poll-closed",
                    poll.id
                ),

            eventKey:
                `poll-closed:${poll.id}:` +
                Date.now(),

            type:
                "poll-closed-announcement",

            payload: {
                pollId:
                    poll.id,

                name:
                    poll.name,

                primary:
                    result.primary,

                secondary:
                    result.secondary
            }
        });
    }

    function queueMilestoneReachedEvent(
        milestone
    ) {
        queueEvent({
            id:
                createEventId(
                    "milestone-reached",
                    milestone.id
                ),

            eventKey:
                `milestone-reached:` +
                milestone.id,

            type:
                "milestone-reached-announcement",

            payload: {
                milestoneId:
                    milestone.id,

                name:
                    milestone.name,

                amount:
                    milestone.amount,

                currency:
                    milestone.currency
            }
        });
    }

    function initializeCampaignState(
        polls,
        milestones,
        campaignTotal
    ) {
        incentiveState =
            createEmptyState();

        incentiveState.initialized =
            true;

        polls.forEach((poll) => {
            incentiveState.pollStates[
                poll.id
            ] = {
                active:
                    poll.active
            };
        });

        milestones.forEach(
            (milestone) => {
                incentiveState
                    .milestoneStates[
                        milestone.id
                    ] = {
                        reached:
                            campaignTotal >=
                            milestone.amount
                    };
            }
        );

        incentiveState.selectedPollIds =
            chooseInitialPollSelection(
                polls.filter((poll) => {
                    return poll.active;
                })
            );

        incentiveState.lastCampaignTotal =
            campaignTotal;

        saveState();
    }

    function processCampaignStateChanges(
        polls,
        milestones,
        campaignTotal
    ) {
        const currentlyActivePolls =
            polls.filter((poll) => {
                return poll.active;
            });

        const newlyOpenedPolls = [];
        const newlyClosedPolls = [];

        polls.forEach((poll) => {
            const previousState =
                incentiveState.pollStates[
                    poll.id
                ];

            if (
                poll.active &&
                (
                    !previousState ||
                    previousState.active ===
                        false
                )
            ) {
                newlyOpenedPolls.push(
                    poll
                );
            }

            if (
                previousState?.active ===
                    true &&
                !poll.active
            ) {
                newlyClosedPolls.push(
                    poll
                );
            }

            incentiveState.pollStates[
                poll.id
            ] = {
                active:
                    poll.active
            };
        });

        newlyOpenedPolls.forEach((poll) => {
            queuePollOpenedEvents(
                poll
            );

            incentiveState
                .selectedPollIds =
                promotePollIntoSelection(
                    incentiveState
                        .selectedPollIds,

                    poll.id,

                    currentlyActivePolls
                );
        });

        newlyClosedPolls.forEach((poll) => {
            queuePollClosedEvent(
                poll
            );
        });

        incentiveState.selectedPollIds =
            fillOpenPollSlots(
                incentiveState
                    .selectedPollIds,

                currentlyActivePolls
            );

        milestones.forEach(
            (milestone) => {
                const reachedNow =
                    campaignTotal >=
                    milestone.amount;

                const previousState =
                    incentiveState
                        .milestoneStates[
                            milestone.id
                        ];

                if (
                    previousState
                        ?.reached === false &&
                    reachedNow &&
                    milestone.active
                ) {
                    queueMilestoneReachedEvent(
                        milestone
                    );
                }

                incentiveState
                    .milestoneStates[
                        milestone.id
                    ] = {
                        reached:
                            reachedNow
                    };
            }
        );

        incentiveState.lastCampaignTotal =
            campaignTotal;

        saveState();
    }

    function updateSelectedActivePolls() {
        const pollById =
            new Map(
                activePolls.map((poll) => {
                    return [
                        poll.id,
                        poll
                    ];
                })
            );

        selectedActivePolls =
            incentiveState
                .selectedPollIds
                .map((pollId) => {
                    return pollById.get(
                        pollId
                    );
                })
                .filter(Boolean);
    }

    function findNextMilestone(
        milestones,
        campaignTotal
    ) {
        const unmetMilestones =
            milestones
                .filter((milestone) => {
                    return (
                        milestone.active &&
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

        return unmetMilestones[0]
            ? {
                ...unmetMilestones[0],

                currentAmount:
                    campaignTotal
            }
            : null;
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

            if (
                !Number.isFinite(
                    campaignTotal
                )
            ) {
                throw new Error(
                    "Campaign total is missing or invalid."
                );
            }

            const normalizedPolls =
                normalizePolls(
                    campaignData.polls
                );

            const normalizedMilestones =
                normalizeMilestones(
                    campaignData.milestones,

                    campaignData.currency ||
                        "USD"
                );

            if (
                shouldResetForNewCampaign(
                    normalizedPolls,
                    normalizedMilestones
                )
            ) {
                incentiveState =
                    createEmptyState();
            }

            if (
                !incentiveState.initialized
            ) {
                initializeCampaignState(
                    normalizedPolls,
                    normalizedMilestones,
                    campaignTotal
                );
            } else {
                processCampaignStateChanges(
                    normalizedPolls,
                    normalizedMilestones,
                    campaignTotal
                );
            }

            allPolls =
                normalizedPolls;

            activePolls =
                normalizedPolls.filter(
                    (poll) => {
                        return poll.active;
                    }
                );

            allMilestones =
                normalizedMilestones;

            updateSelectedActivePolls();

            nextMilestone =
                findNextMilestone(
                    allMilestones,
                    campaignTotal
                );

            showDonationTotal(
                campaignData
            );
        } catch (workerError) {
            console.error(
                "Unable to load live Tiltify campaign data.",
                workerError
            );

            activePolls = [];
            selectedActivePolls = [];
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
     * ROTATOR ELEMENTS
     * ------------------------------------------------------------
     */

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

    let cardAnimationVersion =
        0;

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
            "is-milestone",
            "is-announcement",
            "is-poll-open",
            "is-poll-closed",
            "is-milestone-reached"
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
            slide.alt ||
            "";

        window.requestAnimationFrame(
            () => {
                rotatorImage.classList.add(
                    "is-visible"
                );
            }
        );
    }


    /*
     * ------------------------------------------------------------
     * BID-WAR CARDS
     * ------------------------------------------------------------
     */

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

        optionElement.append(
            rankElement,
            nameElement,
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


    /*
     * ------------------------------------------------------------
     * MILESTONE CARDS
     * ------------------------------------------------------------
     */

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

            const rawProgress =
                clamp(
                    (
                        now -
                        startTime
                    ) /
                    milestoneFillDuration,
                    0,
                    1
                );

            const easedProgress =
                easeInOutCubic(
                    rawProgress
                );

            elements.current.textContent =
                `${formatCurrency(
                    elements.currentAmount *
                        easedProgress,

                    elements.currency
                )} RAISED`;

            elements.percentage.textContent =
                `${Math.round(
                    elements.progress *
                    easedProgress *
                    100
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


    /*
     * ------------------------------------------------------------
     * ANNOUNCEMENT CARDS
     * ------------------------------------------------------------
     */

    function createAnnouncementBody(
        primaryText,
        secondaryText
    ) {
        const body =
            document.createElement(
                "div"
            );

        body.className =
            "announcement-body";

        const primary =
            document.createElement(
                "div"
            );

        primary.className =
            "announcement-primary";

        primary.textContent =
            primaryText;

        body.appendChild(
            primary
        );

        if (secondaryText) {
            const secondary =
                document.createElement(
                    "div"
                );

            secondary.className =
                "announcement-secondary";

            secondary.textContent =
                secondaryText;

            body.appendChild(
                secondary
            );
        }

        return body;
    }

    function paintAnnouncementCard(
        announcement
    ) {
        resetIncentiveCardClasses();

        incentiveCard.classList.add(
            "is-announcement",
            announcement.cardClass
        );

        incentiveLabel.textContent =
            announcement.label;

        incentiveTitle.textContent =
            announcement.title;

        incentiveFooter.textContent =
            "";

        incentiveOptions.replaceChildren(
            createAnnouncementBody(
                announcement.primary,
                announcement.secondary
            )
        );
    }

    async function displayAnnouncementCard(
        announcement,
        transitionDuration
    ) {
        if (!supportsIncentiveCards) {
            return;
        }

        await hideRotatorContent(
            transitionDuration
        );

        paintAnnouncementCard(
            announcement
        );

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


    /*
     * ------------------------------------------------------------
     * QUEUED EVENTS AND NORMAL ROTATION
     * ------------------------------------------------------------
     */

    function buildNormalRotatorItems(
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
            selectedActivePolls.map(
                (poll) => {
                    return {
                        type:
                            "bid-war",

                        duration:
                            bidWarCardDuration,

                        poll
                    };
                }
            );

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

    function findPollById(pollId) {
        return (
            allPolls.find((poll) => {
                return poll.id === pollId;
            }) ||
            null
        );
    }

    function getNextQueuedRotatorItem() {
        while (
            incentiveState
                .pendingEvents
                .length > 0
        ) {
            const event =
                incentiveState
                    .pendingEvents[0];

            if (
                event.type ===
                "poll-open-announcement"
            ) {
                return {
                    type:
                        "announcement",

                    duration:
                        announcementCardDuration,

                    queueEventId:
                        event.id,

                    announcement: {
                        cardClass:
                            "is-poll-open",

                        label:
                            "NEW BID WAR",

                        title:
                            event.payload.name,

                        primary:
                            "BIDDING IS NOW OPEN!",

                        secondary:
                            "DONATE TO CAST YOUR BID"
                    }
                };
            }

            if (
                event.type ===
                "priority-bid-war"
            ) {
                const poll =
                    findPollById(
                        event.payload.pollId
                    );

                if (poll?.active) {
                    return {
                        type:
                            "bid-war",

                        duration:
                            bidWarCardDuration,

                        queueEventId:
                            event.id,

                        poll
                    };
                }

                completeQueuedEvent(
                    event.id
                );

                continue;
            }

            if (
                event.type ===
                "poll-closed-announcement"
            ) {
                return {
                    type:
                        "announcement",

                    duration:
                        announcementCardDuration,

                    queueEventId:
                        event.id,

                    announcement: {
                        cardClass:
                            "is-poll-closed",

                        label:
                            "BIDS CLOSED",

                        title:
                            event.payload.name,

                        primary:
                            event.payload
                                .primary,

                        secondary:
                            event.payload
                                .secondary
                    }
                };
            }

            if (
                event.type ===
                "milestone-reached-announcement"
            ) {
                return {
                    type:
                        "announcement",

                    duration:
                        announcementCardDuration,

                    queueEventId:
                        event.id,

                    announcement: {
                        cardClass:
                            "is-milestone-reached",

                        label:
                            "MILESTONE REACHED",

                        title:
                            event.payload.name,

                        primary:
                            `${formatCurrency(
                                event.payload
                                    .amount,

                                event.payload
                                    .currency
                            )} GOAL MET!`,

                        secondary:
                            "THANK YOU!"
                    }
                };
            }

            completeQueuedEvent(
                event.id
            );
        }

        return null;
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

        if (item.type === "announcement") {
            await displayAnnouncementCard(
                item.announcement,
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

        const {
            slides,
            defaultDuration,
            transitionDuration
        } =
            await loadRotatorConfiguration();

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
            const queuedItem =
                getNextQueuedRotatorItem();

            if (queuedItem) {
                await displayRotatorItem(
                    queuedItem,
                    transitionDuration
                );

                await wait(
                    queuedItem.duration
                );

                if (
                    queuedItem.queueEventId
                ) {
                    completeQueuedEvent(
                        queuedItem
                            .queueEventId
                    );
                }

                continue;
            }

            const items =
                buildNormalRotatorItems(
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
                currentItemIndex =
                    0;
            }

            const currentItem =
                items[
                    currentItemIndex
                ];

            await displayRotatorItem(
                currentItem,
                transitionDuration
            );

            const currentDuration =
                Number.isFinite(
                    currentItem.duration
                )
                    ? currentItem.duration
                    : defaultDuration;

            await wait(
                currentDuration
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
