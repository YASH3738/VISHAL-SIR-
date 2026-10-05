/* =========================================================
   DR. VISHAL YOGI CLINIC
   PREMIUM ANIMATION ENGINE
   ========================================================= */

(function () {
    "use strict";


    /* =====================================================
       CONFIG
       ===================================================== */

    const CONFIG = {

        revealThreshold: 0.12,

        revealRootMargin: "0px 0px -60px 0px",

        parallaxStrength: 0.12,

        cursorEnabled: true,

        magneticStrength: 0.18,

        counterDuration: 1600,

        tiltStrength: 8,

        maxTiltDistance: 80

    };


    /* =====================================================
       REDUCED MOTION
       ===================================================== */

    const prefersReducedMotion =
        window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        ).matches;


    /* =====================================================
       MOBILE DETECTION
       ===================================================== */

    const isTouchDevice =
        "ontouchstart" in window ||
        navigator.maxTouchPoints > 0;


    /* =====================================================
       PAGE LOAD
       ===================================================== */

    function initializeAnimations() {

        setupRevealAnimations();

        setupTextReveal();

        setupStaggerAnimations();

        setupHeroAnimations();

        setupImageAnimations();

        setupCounters();

        setupParallax();

        setupCardTilt();

        setupMagneticElements();

        setupGlowElements();

        setupCursor();

        setupScrollProgress();

        setupPageTransition();

        setupLazyMedia();

    }


    /* =====================================================
       INTERSECTION OBSERVER
       ===================================================== */

    function createObserver(
        callback,
        options = {}
    ) {

        const observer =
            new IntersectionObserver(
                callback,
                {
                    threshold:
                        options.threshold ??
                        CONFIG.revealThreshold,

                    rootMargin:
                        options.rootMargin ??
                        CONFIG.revealRootMargin
                }
            );

        return observer;

    }


    /* =====================================================
       SCROLL REVEAL
       ===================================================== */

    function setupRevealAnimations() {

        const elements =
            document.querySelectorAll(
                ".reveal, .reveal-left, .reveal-right, .reveal-scale, .reveal-blur, .clip-reveal"
            );

        if (!elements.length) {
            return;
        }


        if (prefersReducedMotion) {

            elements.forEach(function (element) {

                element.classList.add(
                    "is-visible"
                );

            });

            return;

        }


        const observer =
            createObserver(
                function (entries, observer) {

                    entries.forEach(
                        function (entry) {

                            if (
                                !entry.isIntersecting
                            ) {
                                return;
                            }

                            entry.target.classList.add(
                                "is-visible"
                            );

                            observer.unobserve(
                                entry.target
                            );

                        }
                    );

                }
            );


        elements.forEach(function (element) {

            observer.observe(element);

        });

    }


    /* =====================================================
       TEXT REVEAL
       ===================================================== */

    function setupTextReveal() {

        const elements =
            document.querySelectorAll(
                "[data-text-reveal]"
            );

        if (!elements.length) {
            return;
        }


        elements.forEach(function (element) {

            /*
             * Don't destroy text if it has already
             * been prepared manually in HTML.
             */

            if (
                element.querySelector(
                    ".text-reveal-line"
                )
            ) {
                return;
            }


            const text =
                element.textContent.trim();

            if (!text) {
                return;
            }


            const words =
                text.split(/\s+/);


            element.textContent = "";


            words.forEach(
                function (word, index) {

                    const span =
                        document.createElement(
                            "span"
                        );

                    span.className =
                        "text-reveal-word";

                    span.textContent =
                        word;


                    span.style.transitionDelay =
                        `${index * 55}ms`;


                    element.appendChild(span);


                    if (
                        index <
                        words.length - 1
                    ) {

                        element.appendChild(
                            document.createTextNode(
                                " "
                            )
                        );

                    }

                }
            );


            if (prefersReducedMotion) {

                element.classList.add(
                    "is-visible"
                );

                return;

            }


            const observer =
                createObserver(
                    function (entries, observer) {

                        entries.forEach(
                            function (entry) {

                                if (
                                    !entry.isIntersecting
                                ) {
                                    return;
                                }

                                entry.target.classList.add(
                                    "is-visible"
                                );

                                observer.unobserve(
                                    entry.target
                                );

                            }
                        );

                    },
                    {
                        threshold: 0.2
                    }
                );


            observer.observe(element);

        });

    }


    /* =====================================================
       STAGGER
       ===================================================== */

    function setupStaggerAnimations() {

        const containers =
            document.querySelectorAll(
                "[data-stagger]"
            );


        containers.forEach(
            function (container) {

                const children =
                    container.children;

                Array.from(children).forEach(
                    function (child, index) {

                        child.style.setProperty(
                            "--stagger-index",
                            index
                        );

                        child.style.transitionDelay =
                            `${index * 80}ms`;

                    }
                );

            }
        );

    }


    /* =====================================================
       HERO ANIMATION
       ===================================================== */

    function setupHeroAnimations() {

        const hero =
            document.querySelector(
                ".hero"
            );

        if (!hero) {
            return;
        }


        if (prefersReducedMotion) {

            hero.classList.add(
                "hero-ready"
            );

            return;

        }


        requestAnimationFrame(
            function () {

                setTimeout(
                    function () {

                        hero.classList.add(
                            "hero-ready"
                        );

                    },
                    120
                );

            }
        );

    }


    /* =====================================================
       IMAGE REVEALS
       ===================================================== */

    function setupImageAnimations() {

        const images =
            document.querySelectorAll(
                "[data-image-reveal]"
            );

        if (!images.length) {
            return;
        }


        if (prefersReducedMotion) {

            images.forEach(function (image) {

                image.classList.add(
                    "image-visible"
                );

            });

            return;

        }


        const observer =
            createObserver(
                function (entries, observer) {

                    entries.forEach(
                        function (entry) {

                            if (
                                !entry.isIntersecting
                            ) {
                                return;
                            }

                            entry.target.classList.add(
                                "image-visible"
                            );

                            observer.unobserve(
                                entry.target
                            );

                        }
                    );

                },
                {
                    threshold: 0.1
                }
            );


        images.forEach(function (image) {

            observer.observe(image);

        });

    }


    /* =====================================================
       COUNTERS
       ===================================================== */

    function setupCounters() {

        const counters =
            document.querySelectorAll(
                "[data-counter]"
            );

        if (!counters.length) {
            return;
        }


        if (prefersReducedMotion) {

            counters.forEach(function (counter) {

                counter.textContent =
                    counter.dataset.counter;

            });

            return;

        }


        const observer =
            createObserver(
                function (entries, observer) {

                    entries.forEach(
                        function (entry) {

                            if (
                                !entry.isIntersecting
                            ) {
                                return;
                            }

                            animateCounter(
                                entry.target
                            );

                            observer.unobserve(
                                entry.target
                            );

                        }
                    );

                },
                {
                    threshold: 0.6
                }
            );


        counters.forEach(function (counter) {

            observer.observe(counter);

        });

    }


    function animateCounter(element) {

        const target =
            parseFloat(
                element.dataset.counter
            );

        if (Number.isNaN(target)) {
            return;
        }


        const prefix =
            element.dataset.prefix || "";

        const suffix =
            element.dataset.suffix || "";


        const decimals =
            element.dataset.decimals
                ? parseInt(
                    element.dataset.decimals,
                    10
                )
                : 0;


        const duration =
            parseInt(
                element.dataset.duration,
                10
            ) ||
            CONFIG.counterDuration;


        const startTime =
            performance.now();


        function update(currentTime) {

            const elapsed =
                currentTime -
                startTime;


            const progress =
                Math.min(
                    elapsed / duration,
                    1
                );


            const eased =
                1 -
                Math.pow(
                    1 - progress,
                    3
                );


            const current =
                target * eased;


            element.textContent =
                prefix +
                current.toFixed(decimals) +
                suffix;


            if (progress < 1) {

                requestAnimationFrame(
                    update
                );

            }

        }


        requestAnimationFrame(update);

    }


    /* =====================================================
       PARALLAX
       ===================================================== */

    function setupParallax() {

        if (prefersReducedMotion) {
            return;
        }

        const elements =
            document.querySelectorAll(
                "[data-parallax]"
            );

        if (!elements.length) {
            return;
        }


        let ticking = false;


        function updateParallax() {

            const viewportHeight =
                window.innerHeight;


            elements.forEach(
                function (element) {

                    const rect =
                        element.getBoundingClientRect();


                    if (
                        rect.bottom < 0 ||
                        rect.top > viewportHeight
                    ) {
                        return;
                    }


                    const speed =
                        parseFloat(
                            element.dataset.parallax
                        ) ||
                        CONFIG.parallaxStrength;


                    const center =
                        rect.top +
                        rect.height / 2;


                    const viewportCenter =
                        viewportHeight / 2;


                    const distance =
                        center -
                        viewportCenter;


                    const translate =
                        distance *
                        speed *
                        -1;


                    element.style.transform =
                        `translate3d(0, ${translate}px, 0)`;

                }
            );


            ticking = false;

        }


        function requestParallax() {

            if (ticking) {
                return;
            }

            ticking = true;

            requestAnimationFrame(
                updateParallax
            );

        }


        window.addEventListener(
            "scroll",
            requestParallax,
            {
                passive: true
            }
        );


        window.addEventListener(
            "resize",
            requestParallax
        );

    }


    /* =====================================================
       CARD TILT
       ===================================================== */

    function setupCardTilt() {

        if (
            prefersReducedMotion ||
            isTouchDevice
        ) {
            return;
        }


        const cards =
            document.querySelectorAll(
                "[data-tilt]"
            );


        cards.forEach(function (card) {

            card.addEventListener(
                "pointermove",
                function (event) {

                    const rect =
                        card.getBoundingClientRect();


                    const x =
                        event.clientX -
                        rect.left;


                    const y =
                        event.clientY -
                        rect.top;


                    const centerX =
                        rect.width / 2;


                    const centerY =
                        rect.height / 2;


                    let rotateX =
                        (
                            y -
                            centerY
                        ) /
                        CONFIG.maxTiltDistance;


                    let rotateY =
                        (
                            x -
                            centerX
                        ) /
                        CONFIG.maxTiltDistance;


                    rotateX =
                        Math.max(
                            -1,
                            Math.min(
                                1,
                                rotateX
                            )
                        );


                    rotateY =
                        Math.max(
                            -1,
                            Math.min(
                                1,
                                rotateY
                            )
                        );


                    card.style.transform =
                        `perspective(900px)
                         rotateX(${
                            -rotateX *
                            CONFIG.tiltStrength
                         }deg)
                         rotateY(${
                            rotateY *
                            CONFIG.tiltStrength
                         }deg)
                         translateY(-4px)`;

                }
            );


            card.addEventListener(
                "pointerleave",
                function () {

                    card.style.transform = "";

                }
            );

        });

    }


    /* =====================================================
       MAGNETIC ELEMENTS
       ===================================================== */

    function setupMagneticElements() {

        if (
            prefersReducedMotion ||
            isTouchDevice
        ) {
            return;
        }


        const elements =
            document.querySelectorAll(
                "[data-magnetic]"
            );


        elements.forEach(function (element) {

            element.addEventListener(
                "pointermove",
                function (event) {

                    const rect =
                        element.getBoundingClientRect();


                    const x =
                        event.clientX -
                        rect.left -
                        rect.width / 2;


                    const y =
                        event.clientY -
                        rect.top -
                        rect.height / 2;


                    const strength =
                        parseFloat(
                            element.dataset.magnetic
                        ) ||
                        CONFIG.magneticStrength;


                    element.style.transform =
                        `translate(
                            ${x * strength}px,
                            ${y * strength}px
                        )`;

                }
            );


            element.addEventListener(
                "pointerleave",
                function () {

                    element.style.transform = "";

                }
            );

        });

    }


    /* =====================================================
       GLOW FOLLOW
       ===================================================== */

    function setupGlowElements() {

        if (
            prefersReducedMotion ||
            isTouchDevice
        ) {
            return;
        }


        const elements =
            document.querySelectorAll(
                "[data-glow]"
            );


        elements.forEach(function (element) {

            element.addEventListener(
                "pointermove",
                function (event) {

                    const rect =
                        element.getBoundingClientRect();


                    const x =
                        event.clientX -
                        rect.left;


                    const y =
                        event.clientY -
                        rect.top;


                    element.style.setProperty(
                        "--glow-x",
                        `${x}px`
                    );


                    element.style.setProperty(
                        "--glow-y",
                        `${y}px`
                    );

                }
            );

        });

    }


    /* =====================================================
       CUSTOM CURSOR
       ===================================================== */

    function setupCursor() {

        if (
            !CONFIG.cursorEnabled ||
            prefersReducedMotion ||
            isTouchDevice
        ) {
            return;
        }


        const cursor =
            document.querySelector(
                ".custom-cursor"
            );


        const follower =
            document.querySelector(
                ".cursor-follower"
            );


        if (
            !cursor ||
            !follower
        ) {
            return;
        }


        let mouseX = 0;
        let mouseY = 0;

        let followerX = 0;
        let followerY = 0;


        document.addEventListener(
            "pointermove",
            function (event) {

                mouseX =
                    event.clientX;

                mouseY =
                    event.clientY;


                cursor.style.transform =
                    `translate3d(
                        ${mouseX}px,
                        ${mouseY}px,
                        0
                    )`;

            }
        );


        function animateFollower() {

            followerX +=
                (
                    mouseX -
                    followerX
                ) * 0.14;


            followerY +=
                (
                    mouseY -
                    followerY
                ) * 0.14;


            follower.style.transform =
                `translate3d(
                    ${followerX}px,
                    ${followerY}px,
                    0
                )`;


            requestAnimationFrame(
                animateFollower
            );

        }


        animateFollower();


        const interactiveElements =
            document.querySelectorAll(
                "a, button, input, textarea, select, [data-cursor-hover]"
            );


        interactiveElements.forEach(
            function (element) {

                element.addEventListener(
                    "pointerenter",
                    function () {

                        document.body.classList.add(
                            "cursor-hover"
                        );

                    }
                );


                element.addEventListener(
                    "pointerleave",
                    function () {

                        document.body.classList.remove(
                            "cursor-hover"
                        );

                    }
                );

            }
        );

    }


    /* =====================================================
       SCROLL PROGRESS
       ===================================================== */

    function setupScrollProgress() {

        const progress =
            document.querySelector(
                "[data-scroll-progress]"
            );


        if (!progress) {
            return;
        }


        function updateProgress() {

            const scrollTop =
                window.scrollY;


            const documentHeight =
                document.documentElement
                    .scrollHeight;


            const viewportHeight =
                window.innerHeight;


            const scrollable =
                documentHeight -
                viewportHeight;


            if (scrollable <= 0) {

                progress.style.width =
                    "0%";

                return;

            }


            const percentage =
                (
                    scrollTop /
                    scrollable
                ) * 100;


            progress.style.width =
                `${percentage}%`;

        }


        window.addEventListener(
            "scroll",
            updateProgress,
            {
                passive: true
            }
        );


        window.addEventListener(
            "resize",
            updateProgress
        );


        updateProgress();

    }


    /* =====================================================
       PAGE TRANSITION
       ===================================================== */

    function setupPageTransition() {

        if (prefersReducedMotion) {
            return;
        }


        const links =
            document.querySelectorAll(
                'a[href]'
            );


        links.forEach(function (link) {

            const href =
                link.getAttribute("href");


            if (!href) {
                return;
            }


            /*
             * Don't animate external links.
             */

            if (
                href.startsWith("http") ||
                href.startsWith("mailto:") ||
                href.startsWith("tel:") ||
                href.startsWith("#") ||
                href.startsWith("javascript:")
            ) {
                return;
            }


            link.addEventListener(
                "click",
                function (event) {

                    /*
                     * Respect modifier keys.
                     */

                    if (
                        event.ctrlKey ||
                        event.metaKey ||
                        event.shiftKey ||
                        event.altKey
                    ) {
                        return;
                    }


                    /*
                     * Don't intercept downloads.
                     */

                    if (
                        link.hasAttribute(
                            "download"
                        )
                    ) {
                        return;
                    }


                    const loader =
                        document.querySelector(
                            ".page-transition"
                        );


                    if (loader) {

                        event.preventDefault();

                        loader.classList.add(
                            "is-active"
                        );


                        setTimeout(
                            function () {

                                window.location.href =
                                    href;

                            },
                            280
                        );

                    }

                }
            );

        });

    }


    /* =====================================================
       LAZY MEDIA
       ===================================================== */

    function setupLazyMedia() {

        const media =
            document.querySelectorAll(
                "img[data-src], video[data-src]"
            );


        if (!media.length) {
            return;
        }


        const observer =
            new IntersectionObserver(
                function (entries, observer) {

                    entries.forEach(
                        function (entry) {

                            if (
                                !entry.isIntersecting
                            ) {
                                return;
                            }


                            const element =
                                entry.target;


                            const source =
                                element.dataset.src;


                            if (source) {

                                element.src =
                                    source;

                            }


                            if (
                                element.tagName ===
                                "VIDEO"
                            ) {

                                element.load();

                            }


                            element.removeAttribute(
                                "data-src"
                            );


                            observer.unobserve(
                                element
                            );

                        }
                    );

                },
                {
                    rootMargin:
                        "200px 0px"
                }
            );


        media.forEach(function (element) {

            observer.observe(element);

        });

    }


    /* =====================================================
       HOVER IMAGE SCALE
       ===================================================== */

    function setupImageHover() {

        if (
            prefersReducedMotion ||
            isTouchDevice
        ) {
            return;
        }


        const wrappers =
            document.querySelectorAll(
                ".image-wrap, .media-frame, [data-image-hover]"
            );


        wrappers.forEach(function (wrapper) {

            const image =
                wrapper.querySelector(
                    "img"
                );


            if (!image) {
                return;
            }


            wrapper.addEventListener(
                "pointerenter",
                function () {

                    image.classList.add(
                        "image-hover-active"
                    );

                }
            );


            wrapper.addEventListener(
                "pointerleave",
                function () {

                    image.classList.remove(
                        "image-hover-active"
                    );

                }
            );

        });

    }


    /* =====================================================
       HORIZONTAL MARQUEE PAUSE
       ===================================================== */

    function setupMarqueeInteraction() {

        const marquees =
            document.querySelectorAll(
                ".marquee, .marquee-track"
            );


        marquees.forEach(function (marquee) {

            marquee.addEventListener(
                "mouseenter",
                function () {

                    marquee.classList.add(
                        "is-paused"
                    );

                }
            );


            marquee.addEventListener(
                "mouseleave",
                function () {

                    marquee.classList.remove(
                        "is-paused"
                    );

                }
            );

        });

    }


    /* =====================================================
       SCROLL TO TOP
       ===================================================== */

    function setupScrollTop() {

        const buttons =
            document.querySelectorAll(
                "[data-scroll-top]"
            );


        buttons.forEach(function (button) {

            button.addEventListener(
                "click",
                function () {

                    window.scrollTo({
                        top: 0,
                        behavior:
                            prefersReducedMotion
                                ? "auto"
                                : "smooth"
                    });

                }
            );

        });

    }


    /* =====================================================
       INITIALIZE EXTRA FEATURES
       ===================================================== */

    function initializeExtraAnimations() {

        setupImageHover();

        setupMarqueeInteraction();

        setupScrollTop();

    }


    /* =====================================================
       BOOT
       ===================================================== */

    function boot() {

        initializeAnimations();

        initializeExtraAnimations();

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            boot
        );

    } else {

        boot();

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.DrVishalAnimations = {

        reveal(element) {

            if (!element) {
                return;
            }

            element.classList.add(
                "is-visible"
            );

        },

        counter(element) {

            if (!element) {
                return;
            }

            animateCounter(element);

        },

        refresh() {

            setupRevealAnimations();

            setupTextReveal();

            setupCounters();

        }

    };

})();