/* =========================================================
   DR. VISHAL YOGI CLINIC
   NAVIGATION SYSTEM
   ========================================================= */

(function () {
    "use strict";

    /* =====================================================
       DOM ELEMENTS
       ===================================================== */

    const navbar = document.querySelector(".navbar");
    const menuToggle = document.querySelector(
        ".menu-toggle, .navbar__toggle"
    );
    const navMenu = document.querySelector(
        ".nav-menu, .nav-links, .navbar__links"
    );

    const navLinks = document.querySelectorAll(
        ".nav-link, .nav-menu a, .navbar__link"
    );

    const body = document.body;


    /* =====================================================
       CONFIGURATION
       ===================================================== */

    const CONFIG = {
        scrollThreshold: 40,
        mobileBreakpoint: 900,
        activeClass: "active",
        openClass: "menu-open",
        scrolledClass: "is-scrolled"
    };


    /* =====================================================
       INITIAL STATE
       ===================================================== */

    function initializeNavigation() {
        setActivePage();
        handleInitialScrollState();
        setupMobileMenu();
        setupScrollBehavior();
        setupAnchorLinks();
        setupOutsideClick();
        setupEscapeKey();
        setupResizeHandler();
    }


    /* =====================================================
       ACTIVE PAGE
       ===================================================== */

    function setActivePage() {

        const currentPath = window.location.pathname;

        let currentPage = currentPath
            .split("/")
            .pop()
            .toLowerCase();

        /*
         * Empty path normally means homepage.
         */

        if (
            currentPage === "" ||
            currentPage === "/" ||
            currentPage === "index"
        ) {
            currentPage = "index.html";
        }

        navLinks.forEach(function (link) {

            const href = link.getAttribute("href");

            if (!href) {
                return;
            }

            /*
             * Ignore external links and hash-only links.
             */

            if (
                href.startsWith("http") ||
                href.startsWith("mailto:") ||
                href.startsWith("tel:") ||
                href.startsWith("#")
            ) {
                return;
            }

            const linkPage = href
                .split("/")
                .pop()
                .split("#")[0]
                .toLowerCase();

            link.classList.remove(CONFIG.activeClass);

            if (
                linkPage === currentPage ||
                (
                    currentPage === "index.html" &&
                    linkPage === ""
                )
            ) {
                link.classList.add(CONFIG.activeClass);
            }

        });
    }


    /* =====================================================
       STICKY NAVBAR
       ===================================================== */

    function updateNavbarState() {

        if (!navbar) {
            return;
        }

        const scrollPosition = window.scrollY;

        if (scrollPosition > CONFIG.scrollThreshold) {
            navbar.classList.add(CONFIG.scrolledClass);
        } else {
            navbar.classList.remove(CONFIG.scrolledClass);
        }

    }


    function handleInitialScrollState() {
        updateNavbarState();
    }


    /* =====================================================
       SCROLL LISTENER
       ===================================================== */

    let ticking = false;

    function handleScroll() {

        if (!ticking) {

            window.requestAnimationFrame(function () {

                updateNavbarState();

                ticking = false;

            });

            ticking = true;
        }

    }


    function setupScrollBehavior() {
        window.addEventListener(
            "scroll",
            handleScroll,
            {
                passive: true
            }
        );
    }


    /* =====================================================
       MOBILE MENU
       ===================================================== */

    function setupMobileMenu() {

        if (!menuToggle || !navMenu) {
            return;
        }

        menuToggle.addEventListener(
            "click",
            function () {

                toggleMobileMenu();

            }
        );


        /*
         * Close menu when clicking a navigation link.
         */

        navMenu.addEventListener(
            "click",
            function (event) {

                const clickedLink =
                    event.target.closest("a");

                if (!clickedLink) {
                    return;
                }

                closeMobileMenu();

            }
        );

    }


    function toggleMobileMenu() {

        const isOpen =
            body.classList.contains(CONFIG.openClass);

        if (isOpen) {
            closeMobileMenu();
        } else {
            openMobileMenu();
        }

    }


    function openMobileMenu() {

        body.classList.add(CONFIG.openClass);

        if (navMenu) {
            navMenu.classList.add("is-open");
        }

        if (menuToggle) {

            menuToggle.classList.add("is-active");

            menuToggle.setAttribute(
                "aria-expanded",
                "true"
            );

        }

        /*
         * Prevent background page scrolling.
         */

        if (window.innerWidth <= CONFIG.mobileBreakpoint) {
            body.style.overflow = "hidden";
        }

    }


    function closeMobileMenu() {

        body.classList.remove(CONFIG.openClass);

        if (navMenu) {
            navMenu.classList.remove("is-open");
        }

        if (menuToggle) {

            menuToggle.classList.remove("is-active");

            menuToggle.setAttribute(
                "aria-expanded",
                "false"
            );

        }

        body.style.overflow = "";

    }


    /* =====================================================
       OUTSIDE CLICK
       ===================================================== */

    function setupOutsideClick() {

        document.addEventListener(
            "click",
            function (event) {

                if (!body.classList.contains(CONFIG.openClass)) {
                    return;
                }

                if (
                    navMenu &&
                    navMenu.contains(event.target)
                ) {
                    return;
                }

                if (
                    menuToggle &&
                    menuToggle.contains(event.target)
                ) {
                    return;
                }

                closeMobileMenu();

            }
        );

    }


    /* =====================================================
       ESCAPE KEY
       ===================================================== */

    function setupEscapeKey() {

        document.addEventListener(
            "keydown",
            function (event) {

                if (event.key !== "Escape") {
                    return;
                }

                closeMobileMenu();

            }
        );

    }


    /* =====================================================
       RESIZE HANDLER
       ===================================================== */

    let resizeTimer;

    function setupResizeHandler() {

        window.addEventListener(
            "resize",
            function () {

                clearTimeout(resizeTimer);

                resizeTimer = setTimeout(
                    function () {

                        if (
                            window.innerWidth >
                            CONFIG.mobileBreakpoint
                        ) {
                            closeMobileMenu();
                        }

                    },
                    150
                );

            }
        );

    }


    /* =====================================================
       SMOOTH ANCHOR NAVIGATION
       ===================================================== */

    function setupAnchorLinks() {

        document.addEventListener(
            "click",
            function (event) {

                const link =
                    event.target.closest(
                        'a[href^="#"]'
                    );

                if (!link) {
                    return;
                }

                const href =
                    link.getAttribute("href");

                if (
                    !href ||
                    href === "#" ||
                    href === "#!"
                ) {
                    return;
                }

                const target =
                    document.querySelector(href);

                if (!target) {
                    return;
                }

                event.preventDefault();

                const navbarHeight =
                    navbar
                        ? navbar.offsetHeight
                        : 0;

                const targetPosition =
                    target.getBoundingClientRect().top +
                    window.scrollY -
                    navbarHeight -
                    20;

                window.scrollTo({
                    top: targetPosition,
                    behavior: "smooth"
                });

                closeMobileMenu();

                /*
                 * Update URL without forcing reload.
                 */

                try {

                    history.pushState(
                        null,
                        "",
                        href
                    );

                } catch (error) {
                    /*
                     * Ignore browsers that block
                     * history manipulation.
                     */
                }

            }
        );

    }


    /* =====================================================
       DROPDOWN READY SUPPORT
       ===================================================== */

    const dropdownTriggers =
        document.querySelectorAll(
            "[data-dropdown-trigger]"
        );


    dropdownTriggers.forEach(function (trigger) {

        trigger.addEventListener(
            "click",
            function (event) {

                const dropdown =
                    trigger.parentElement
                        ?.querySelector(
                            "[data-dropdown]"
                        );

                if (!dropdown) {
                    return;
                }

                event.preventDefault();

                const isOpen =
                    dropdown.classList.contains(
                        "is-open"
                    );

                /*
                 * Close all dropdowns first.
                 */

                document
                    .querySelectorAll(
                        "[data-dropdown].is-open"
                    )
                    .forEach(function (item) {

                        item.classList.remove(
                            "is-open"
                        );

                    });

                if (!isOpen) {

                    dropdown.classList.add(
                        "is-open"
                    );

                }

            }
        );

    });


    /* =====================================================
       CLOSE DROPDOWNS ON OUTSIDE CLICK
       ===================================================== */

    document.addEventListener(
        "click",
        function (event) {

            if (
                event.target.closest(
                    "[data-dropdown-trigger]"
                )
            ) {
                return;
            }

            document
                .querySelectorAll(
                    "[data-dropdown].is-open"
                )
                .forEach(function (dropdown) {

                    dropdown.classList.remove(
                        "is-open"
                    );

                });

        }
    );


    /* =====================================================
       HEADER HIDE / SHOW ON SCROLL
       ===================================================== */

    let lastScrollPosition = window.scrollY;

    function handleNavbarDirection() {

        if (!navbar) {
            return;
        }

        const currentScroll =
            window.scrollY;

        /*
         * Don't hide navbar near top.
         */

        if (currentScroll <= 120) {

            navbar.classList.remove(
                "navbar-hidden"
            );

            lastScrollPosition =
                currentScroll;

            return;

        }


        /*
         * Don't interfere with mobile menu.
         */

        if (
            body.classList.contains(
                CONFIG.openClass
            )
        ) {
            return;
        }


        if (
            currentScroll >
            lastScrollPosition + 8
        ) {

            navbar.classList.add(
                "navbar-hidden"
            );

        } else if (
            currentScroll <
            lastScrollPosition - 8
        ) {

            navbar.classList.remove(
                "navbar-hidden"
            );

        }

        lastScrollPosition =
            currentScroll;

    }


    let navbarDirectionTick = false;

    window.addEventListener(
        "scroll",
        function () {

            if (navbarDirectionTick) {
                return;
            }

            navbarDirectionTick = true;

            window.requestAnimationFrame(
                function () {

                    handleNavbarDirection();

                    navbarDirectionTick = false;

                }
            );

        },
        {
            passive: true
        }
    );


    /* =====================================================
       ACCESSIBILITY
       ===================================================== */

    function setupAccessibility() {

        if (!menuToggle) {
            return;
        }

        if (
            !menuToggle.hasAttribute(
                "aria-expanded"
            )
        ) {

            menuToggle.setAttribute(
                "aria-expanded",
                "false"
            );

        }

        if (
            !menuToggle.hasAttribute(
                "aria-label"
            )
        ) {

            menuToggle.setAttribute(
                "aria-label",
                "Open navigation menu"
            );

        }

    }


    /* =====================================================
       INITIALIZE
       ===================================================== */

    function bootNavigation() {

        setupAccessibility();
        initializeNavigation();

    }


    if (
        document.readyState === "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            bootNavigation
        );

    } else {

        bootNavigation();

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.DrVishalNavigation = {

        openMenu: openMobileMenu,

        closeMenu: closeMobileMenu,

        toggleMenu: toggleMobileMenu,

        updateNavbar: updateNavbarState

    };

})();