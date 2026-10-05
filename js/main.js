/* =========================================================
   DR. VISHAL YOGI PHYSIOTHERAPY & WELLNESS CLINIC
   MAIN JAVASCRIPT CONTROLLER
   ========================================================= */

(function () {
    "use strict";


    /* =====================================================
       GLOBAL CONFIGURATION
       ===================================================== */

    const CONFIG = {

        clinicName:
            "Dr. Vishal Yogi Physiotherapy & Wellness Clinic",

        phone:
            "07014138261",

        whatsapp:
            "917014138261",

        maps:
            "https://maps.app.goo.gl/2uKHQ6nTtAYhfy7R9",

        timings:
            "7:00 AM – 12:00 PM & 6:00 PM – 11:00 PM",

        consultationFee:
            "₹300",

        homeVisitFee:
            "₹700",

        onlineConsultationFee:
            "₹200"

    };


    /* =====================================================
       DOM READY
       ===================================================== */

    function ready(callback) {

        if (
            document.readyState ===
            "loading"
        ) {

            document.addEventListener(
                "DOMContentLoaded",
                callback
            );

        } else {

            callback();

        }

    }

    function getAppointmentApiBase() {
        const configuredBase = document.querySelector(
            'meta[name="api-base-url"]'
        )?.content.trim();

        if (configuredBase) {
            return configuredBase.replace(/\/+$/, "");
        }

        return window.location.protocol === "file:"
            ? "http://localhost:5000"
            : "";
    }


    /* =====================================================
       PAGE LOADER
       ===================================================== */

    function initializePageLoader() {

        const loader =
            document.querySelector(
                ".page-loader"
            );


        if (!loader) {
            return;
        }


        function hideLoader() {

            loader.classList.add(
                "is-loaded"
            );


            setTimeout(
                function () {

                    loader.classList.add(
                        "is-hidden"
                    );

                },
                700
            );

        }


        if (
            document.readyState ===
            "complete"
        ) {

            setTimeout(
                hideLoader,
                250
            );

        } else {

            window.addEventListener(
                "load",
                function () {

                    setTimeout(
                        hideLoader,
                        250
                    );

                },
                {
                    once: true
                }
            );

        }


        /*
         * Safety fallback.
         * The loader should never block the website
         * indefinitely.
         */

        setTimeout(
            hideLoader,
            3500
        );

    }


    /* =====================================================
       CURRENT YEAR
       ===================================================== */

    function initializeCurrentYear() {

        const yearElements =
            document.querySelectorAll(
                "[data-current-year]"
            );


        const currentYear =
            new Date().getFullYear();


        yearElements.forEach(
            function (element) {

                element.textContent =
                    currentYear;

            }
        );

    }


    /* =====================================================
       CLINIC DATA BINDING
       ===================================================== */

    function initializeClinicData() {

        const phoneElements =
            document.querySelectorAll(
                "[data-clinic-phone]"
            );


        phoneElements.forEach(
            function (element) {

                element.textContent =
                    CONFIG.phone;

            }
        );


        const timingElements =
            document.querySelectorAll(
                "[data-clinic-timings]"
            );


        timingElements.forEach(
            function (element) {

                element.textContent =
                    CONFIG.timings;

            }
        );


        const consultationElements =
            document.querySelectorAll(
                "[data-consultation-fee]"
            );


        consultationElements.forEach(
            function (element) {

                element.textContent =
                    CONFIG.consultationFee;

            }
        );


        const homeVisitElements =
            document.querySelectorAll(
                "[data-home-visit-fee]"
            );


        homeVisitElements.forEach(
            function (element) {

                element.textContent =
                    CONFIG.homeVisitFee;

            }
        );


        const mapLinks =
            document.querySelectorAll(
                "[data-clinic-map]"
            );


        mapLinks.forEach(
            function (element) {

                element.href =
                    CONFIG.maps;

            }
        );

    }


    /* =====================================================
       WHATSAPP
       ===================================================== */

    function initializeWhatsApp() {

        const buttons =
            document.querySelectorAll(
                "[data-whatsapp]"
            );


        buttons.forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function (event) {

                        event.preventDefault();


                        const customMessage =
                            button.dataset.whatsappMessage ||
                            "Hello Dr. Vishal Yogi, I would like to enquire about physiotherapy consultation.";


                        openWhatsApp(
                            customMessage
                        );

                    }
                );

            }
        );

    }


    function openWhatsApp(message) {

        const encodedMessage =
            encodeURIComponent(
                message
            );


        const url =
            `https://wa.me/${CONFIG.whatsapp}?text=${encodedMessage}`;


        window.open(
            url,
            "_blank",
            "noopener,noreferrer"
        );

    }


    /* =====================================================
       PHONE CALL
       ===================================================== */

    function initializeCallButtons() {

        const buttons =
            document.querySelectorAll(
                "[data-call]"
            );


        buttons.forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function (event) {

                        event.preventDefault();

                        window.location.href =
                            `tel:+91${CONFIG.phone}`;

                    }
                );

            }
        );

    }


    /* =====================================================
       GOOGLE MAPS
       ===================================================== */

    function initializeMapButtons() {

        const buttons =
            document.querySelectorAll(
                "[data-open-map]"
            );


        buttons.forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function (event) {

                        event.preventDefault();


                        window.open(
                            CONFIG.maps,
                            "_blank",
                            "noopener,noreferrer"
                        );

                    }
                );

            }
        );

    }


    /* =====================================================
       FAQ ACCORDION
       ===================================================== */

    function initializeFAQ() {

        const faqItems =
            document.querySelectorAll(
                ".faq-item"
            );


        if (!faqItems.length) {
            return;
        }


        faqItems.forEach(
            function (item) {

                const question =
                    item.querySelector(
                        ".faq-question"
                    );


                const answer =
                    item.querySelector(
                        ".faq-answer"
                    );


                if (
                    !question ||
                    !answer
                ) {
                    return;
                }


                question.setAttribute(
                    "aria-expanded",
                    "false"
                );


                answer.style.maxHeight =
                    "0px";


                question.addEventListener(
                    "click",
                    function () {

                        const isOpen =
                            item.classList.contains(
                                "is-open"
                            );


                        /*
                         * Close all other FAQ items.
                         */

                        faqItems.forEach(
                            function (otherItem) {

                                if (
                                    otherItem ===
                                    item
                                ) {
                                    return;
                                }


                                const otherQuestion =
                                    otherItem.querySelector(
                                        ".faq-question"
                                    );


                                const otherAnswer =
                                    otherItem.querySelector(
                                        ".faq-answer"
                                    );


                                otherItem.classList.remove(
                                    "is-open"
                                );


                                otherQuestion?.setAttribute(
                                    "aria-expanded",
                                    "false"
                                );


                                if (
                                    otherAnswer
                                ) {

                                    otherAnswer.style.maxHeight =
                                        "0px";

                                }

                            }
                        );


                        /*
                         * Toggle selected FAQ.
                         */

                        if (isOpen) {

                            item.classList.remove(
                                "is-open"
                            );


                            question.setAttribute(
                                "aria-expanded",
                                "false"
                            );


                            answer.style.maxHeight =
                                "0px";

                        } else {

                            item.classList.add(
                                "is-open"
                            );


                            question.setAttribute(
                                "aria-expanded",
                                "true"
                            );


                            answer.style.maxHeight =
                                `${answer.scrollHeight}px`;

                        }

                    }
                );

            }
        );

    }


    /* =====================================================
       GENERIC ACCORDION
       ===================================================== */

    function initializeAccordions() {

        const triggers =
            document.querySelectorAll(
                "[data-accordion-trigger]"
            );


        triggers.forEach(
            function (trigger) {

                trigger.addEventListener(
                    "click",
                    function () {

                        const targetSelector =
                            trigger.dataset.accordionTrigger;


                        if (!targetSelector) {
                            return;
                        }


                        const target =
                            document.querySelector(
                                targetSelector
                            );


                        if (!target) {
                            return;
                        }


                        const isOpen =
                            target.classList.contains(
                                "is-open"
                            );


                        target.classList.toggle(
                            "is-open"
                        );


                        trigger.classList.toggle(
                            "is-active"
                        );


                        trigger.setAttribute(
                            "aria-expanded",
                            String(!isOpen)
                        );

                    }
                );

            }
        );

    }


    /* =====================================================
       VIDEO CONTROL
       ===================================================== */

    function initializeVideos() {

        const videos =
            document.querySelectorAll(
                "video"
            );


        if (!videos.length) {
            return;
        }


        videos.forEach(
            function (video) {

                /*
                 * Pause other videos when one starts.
                 */

                video.addEventListener(
                    "play",
                    function () {

                        videos.forEach(
                            function (otherVideo) {

                                if (
                                    otherVideo !==
                                    video
                                ) {

                                    otherVideo.pause();

                                }

                            }
                        );

                    }
                );


                /*
                 * Mark video as loaded.
                 */

                if (
                    video.readyState >= 3
                ) {

                    video.classList.add(
                        "is-ready"
                    );

                }


                video.addEventListener(
                    "loadeddata",
                    function () {

                        video.classList.add(
                            "is-ready"
                        );

                    }
                );

            }
        );

    }


    /* =====================================================
       BACK TO TOP
       ===================================================== */

    function initializeBackToTop() {

        const buttons =
            document.querySelectorAll(
                "[data-back-to-top]"
            );


        if (!buttons.length) {
            return;
        }


        function updateVisibility() {

            const visible =
                window.scrollY >
                600;


            buttons.forEach(
                function (button) {

                    button.classList.toggle(
                        "is-visible",
                        visible
                    );

                }
            );

        }


        window.addEventListener(
            "scroll",
            updateVisibility,
            {
                passive: true
            }
        );


        buttons.forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function () {

                        window.scrollTo({
                            top: 0,
                            behavior:
                                window.matchMedia(
                                    "(prefers-reduced-motion: reduce)"
                                ).matches
                                    ? "auto"
                                    : "smooth"
                        });

                    }
                );

            }
        );


        updateVisibility();

    }


    /* =====================================================
       BUTTON RIPPLE
       ===================================================== */

    function initializeButtonRipple() {

        const buttons =
            document.querySelectorAll(
                ".btn, [data-ripple]"
            );


        buttons.forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    function (event) {

                        const rect =
                            button.getBoundingClientRect();


                        const ripple =
                            document.createElement(
                                "span"
                            );


                        ripple.className =
                            "button-ripple";


                        const size =
                            Math.max(
                                rect.width,
                                rect.height
                            );


                        ripple.style.width =
                            `${size}px`;


                        ripple.style.height =
                            `${size}px`;


                        ripple.style.left =
                            `${
                                event.clientX -
                                rect.left -
                                size / 2
                            }px`;


                        ripple.style.top =
                            `${
                                event.clientY -
                                rect.top -
                                size / 2
                            }px`;


                        button.appendChild(
                            ripple
                        );


                        setTimeout(
                            function () {

                                ripple.remove();

                            },
                            650
                        );

                    }
                );

            }
        );

    }


    /* =====================================================
       EXTERNAL LINKS
       ===================================================== */

    function initializeExternalLinks() {

        const links =
            document.querySelectorAll(
                'a[href^="http"]'
            );


        links.forEach(
            function (link) {

                try {

                    const url =
                        new URL(
                            link.href,
                            window.location.href
                        );


                    if (
                        url.hostname !==
                        window.location.hostname
                    ) {

                        link.target =
                            "_blank";


                        link.rel =
                            "noopener noreferrer";

                    }

                } catch (error) {

                    /*
                     * Ignore invalid URLs.
                     */

                }

            }
        );

    }


    /* =====================================================
       IMAGE ERROR HANDLING
       ===================================================== */

    function initializeImageFallbacks() {

        const images =
            document.querySelectorAll(
                "img"
            );


        images.forEach(
            function (image) {

                image.addEventListener(
                    "error",
                    function () {

                        image.classList.add(
                            "image-error"
                        );


                        /*
                         * Keep the layout intact.
                         * Don't replace with fake imagery.
                         */

                        image.setAttribute(
                            "aria-label",
                            "Image unavailable"
                        );

                    }
                );

            }
        );

    }


    /* =====================================================
       EXTERNAL MEDIA LAZY LOADING
       ===================================================== */

    function initializeNativeLazyLoading() {

        const images =
            document.querySelectorAll(
                "img:not([loading])"
            );


        images.forEach(
            function (image) {

                /*
                 * Hero images should remain eager.
                 */

                if (
                    image.closest(".hero")
                ) {
                    image.loading =
                        "eager";

                    return;
                }


                image.loading =
                    "lazy";

            }
        );

    }


    /* =====================================================
       ACTIVE SECTION NAVIGATION
       ===================================================== */

    function initializeSectionTracking() {

        const sections =
            document.querySelectorAll(
                "section[id]"
            );


        const links =
            document.querySelectorAll(
                'a[href^="#"]'
            );


        if (
            !sections.length ||
            !links.length
        ) {
            return;
        }


        const observer =
            new IntersectionObserver(
                function (entries) {

                    entries.forEach(
                        function (entry) {

                            if (
                                !entry.isIntersecting
                            ) {
                                return;
                            }


                            const id =
                                entry.target.id;


                            links.forEach(
                                function (link) {

                                    const href =
                                        link.getAttribute(
                                            "href"
                                        );


                                    if (
                                        href ===
                                        `#${id}`
                                    ) {

                                        link.classList.add(
                                            "section-active"
                                        );

                                    } else {

                                        link.classList.remove(
                                            "section-active"
                                        );

                                    }

                                }
                            );

                        }
                    );

                },
                {
                    threshold: 0.35
                }
            );


        sections.forEach(
            function (section) {

                observer.observe(section);

            }
        );

    }


    /* =====================================================
       COPY TO CLIPBOARD
       ===================================================== */

    function initializeCopyButtons() {

        const buttons =
            document.querySelectorAll(
                "[data-copy]"
            );


        buttons.forEach(
            function (button) {

                button.addEventListener(
                    "click",
                    async function () {

                        const text =
                            button.dataset.copy;


                        if (!text) {
                            return;
                        }


                        try {

                            await navigator.clipboard.writeText(
                                text
                            );


                            const original =
                                button.textContent;


                            button.textContent =
                                "Copied";


                            setTimeout(
                                function () {

                                    button.textContent =
                                        original;

                                },
                                1400
                            );

                        } catch (error) {

                            /*
                             * Clipboard may be blocked
                             * by browser permissions.
                             */

                        }

                    }
                );

            }
        );

    }


    /* =====================================================
       DYNAMIC EXTERNAL URL HELPERS
       ===================================================== */

    function initializeDynamicActions() {

        document
            .querySelectorAll(
                "[data-whatsapp-message]"
            )
            .forEach(
                function (element) {

                    if (
                        element.tagName ===
                        "A" &&
                        !element.href
                    ) {

                        element.href =
                            `https://wa.me/${CONFIG.whatsapp}`;

                    }

                }
            );

    }


    /* =====================================================
       DELAYED ASSISTANCE DIALOG
       ===================================================== */

    function initializeAssistanceDialog() {

        const storageKey = "vishal-assistance-dialog-shown";
        let alreadyShown = false;

        try {
            alreadyShown = sessionStorage.getItem(storageKey) === "true";
        } catch (error) {
            console.warn("Could not read assistance-dialog session state.", error);
        }

        if (alreadyShown) {
            return;
        }

        const dialog = document.createElement("section");
        dialog.className = "assistance-dialog";
        dialog.setAttribute("aria-hidden", "true");
        dialog.setAttribute("inert", "");
        dialog.innerHTML = `
            <div class="assistance-dialog__backdrop" data-assistance-close></div>
            <div class="assistance-dialog__panel" role="dialog" aria-modal="true" aria-labelledby="assistance-dialog-title" aria-describedby="assistance-dialog-copy">
                <button class="assistance-dialog__close" type="button" aria-label="Close assistance options" data-assistance-close>
                    <i class="fa-solid fa-xmark" aria-hidden="true"></i>
                </button>
                <span class="assistance-dialog__eyebrow"><i class="fa-solid fa-heart-pulse" aria-hidden="true"></i> Dr. Vishal Yogi Physiotherapy</span>
                <h2 id="assistance-dialog-title">Need assistance?</h2>
                <p id="assistance-dialog-copy">We're here to help you choose the right next step for your recovery.</p>
                <div class="assistance-dialog__actions">
                    <a class="assistance-dialog__action assistance-dialog__action--call" href="tel:+917014138261">
                        <span class="assistance-dialog__action-icon"><i class="fa-solid fa-phone" aria-hidden="true"></i></span>
                        <span><strong>Call the clinic</strong><small>Speak with our team</small></span>
                        <i class="fa-solid fa-arrow-up-right-from-square assistance-dialog__arrow" aria-hidden="true"></i>
                    </a>
                    <a class="assistance-dialog__action assistance-dialog__action--whatsapp" href="https://wa.me/917014138261?text=Hello%2C%20I%20need%20assistance%20with%20physiotherapy." target="_blank" rel="noopener noreferrer">
                        <span class="assistance-dialog__action-icon"><i class="fa-brands fa-whatsapp" aria-hidden="true"></i></span>
                        <span><strong>Chat on WhatsApp</strong><small>Message us for guidance</small></span>
                        <i class="fa-solid fa-arrow-up-right-from-square assistance-dialog__arrow" aria-hidden="true"></i>
                    </a>
                    <a class="assistance-dialog__action assistance-dialog__action--book" href="appointment.html">
                        <span class="assistance-dialog__action-icon"><i class="fa-regular fa-calendar-check" aria-hidden="true"></i></span>
                        <span><strong>Book an appointment</strong><small>With Dr. Vishal Yogi</small></span>
                        <i class="fa-solid fa-arrow-right assistance-dialog__arrow" aria-hidden="true"></i>
                    </a>
                </div>
                <span class="assistance-dialog__footer">Personalised physiotherapy care in Jaipur & online</span>
            </div>
        `;

        document.body.appendChild(dialog);

        let previouslyFocusedElement = null;

        function rememberDialogShown() {
            try {
                sessionStorage.setItem(storageKey, "true");
            } catch (error) {
                console.warn("Could not save assistance-dialog session state.", error);
            }
        }

        function closeDialog() {
            dialog.classList.remove("is-open");
            dialog.setAttribute("aria-hidden", "true");
            dialog.setAttribute("inert", "");
            document.body.classList.remove("assistance-dialog-open");
            document.removeEventListener("keydown", handleKeydown);
            previouslyFocusedElement?.focus();
        }

        function handleKeydown(event) {
            if (event.key === "Escape") {
                closeDialog();
                return;
            }

            if (event.key === "Tab") {
                const focusable = Array.from(
                    dialog.querySelectorAll("button:not([disabled]), a[href]")
                );
                const first = focusable[0];
                const last = focusable[focusable.length - 1];

                if (event.shiftKey && document.activeElement === first) {
                    event.preventDefault();
                    last?.focus();
                } else if (!event.shiftKey && document.activeElement === last) {
                    event.preventDefault();
                    first?.focus();
                }
            }
        }

        dialog.querySelectorAll("[data-assistance-close]").forEach(function (control) {
            control.addEventListener("click", closeDialog);
        });

        dialog.querySelectorAll("a").forEach(function (link) {
            link.addEventListener("click", function () {
                rememberDialogShown();
                closeDialog();
            });
        });

        function showDialog() {
            rememberDialogShown();
            previouslyFocusedElement = document.activeElement;
            dialog.removeAttribute("inert");
            dialog.setAttribute("aria-hidden", "false");
            dialog.classList.add("is-open");
            document.body.classList.add("assistance-dialog-open");
            document.addEventListener("keydown", handleKeydown);
            dialog.querySelector(".assistance-dialog__close")?.focus();
        }

        window.setTimeout(showDialog, 30000);
    }


    /* =====================================================
       PERFORMANCE: HOVER CLASS
       ===================================================== */

    function initializeHoverState() {

        const elements =
            document.querySelectorAll(
                ".card, .btn, .gallery-item, .care-card, .service-card"
            );


        elements.forEach(
            function (element) {

                element.addEventListener(
                    "mouseenter",
                    function () {

                        element.classList.add(
                            "is-hovered"
                        );

                    }
                );


                element.addEventListener(
                    "mouseleave",
                    function () {

                        element.classList.remove(
                            "is-hovered"
                        );

                    }
                );

            }
        );

    }


    /* =====================================================
       CONTACT FORM FRONTEND HANDLER
       ===================================================== */

    function initializeContactForms() {

        const forms =
            document.querySelectorAll(
                "form[data-contact-form]"
            );


        forms.forEach(
            function (form) {

                form.addEventListener(
                    "submit",
                    function (event) {

                        /*
                         * Frontend-only stage.
                         *
                         * Prevent actual submission until
                         * backend / Google Script is connected.
                         */

                        event.preventDefault();


                        const status =
                            form.querySelector(
                                "[data-form-status]"
                            );


                        if (status) {

                            status.textContent =
                                "Your request has been received. Online submission will be connected shortly.";

                            status.classList.add(
                                "is-visible"
                            );

                        }


                        form.classList.add(
                            "form-submitted"
                        );

                    }
                );

            }
        );

    }


    /* =====================================================
       APPOINTMENT FORM FRONTEND HANDLER
       ===================================================== */

    function initializeBookingWizard() {

        const form = document.querySelector(
            "form[data-appointment-form]"
        );

        if (!form) {
            return;
        }

        const steps = Array.from(
            form.querySelectorAll("[data-booking-step]")
        );
        const indicators = Array.from(
            form.querySelectorAll("[data-booking-step-indicator]")
        );
        const progressLines = Array.from(
            form.querySelectorAll(".booking-progress__line")
        );
        const dateInput = form.querySelector("[data-appointment-date]");
        const selectedTimeField = form.querySelector("[data-selected-time]");
        const submitButton = form.querySelector("[data-booking-submit]");
        const timeStatus = form.querySelector("[data-slot-status]");
        const timeHelp = form.querySelector("[data-slot-help]");
        const timeSlotsContainer = form.querySelector("[data-time-slots]");
        const homeAddressField = form.querySelector("[data-home-address-field]");
        const homeAddressInput = homeAddressField?.querySelector("textarea");
        let currentStep = 1;
        let selectedTime = "";
        let availabilityRequestId = 0;

        function updateSummary() {

            const selectedService = form.querySelector(
                "[data-service-type]:checked"
            );

            const service = selectedService?.value || "Clinic Consultation";
            const price = selectedService?.dataset.price || "300";
            const originalPrice = selectedService?.dataset.originalPrice || price;
            const serviceSummary = form.querySelector("[data-service-summary]");

            if (serviceSummary) {
                serviceSummary.value = service;
            }

            const serviceValue = form.querySelector("[data-summary-service]");
            const priceValue = form.querySelector("[data-summary-price]");

            if (serviceValue) serviceValue.textContent = service;
            if (priceValue) {
                const originalPriceValue = priceValue.querySelector("[data-summary-original]");
                const currentPriceValue = priceValue.querySelector("[data-summary-current]");

                if (originalPriceValue) {
                    originalPriceValue.textContent = `₹${originalPrice}`;
                    originalPriceValue.hidden = originalPrice === price;
                }

                if (currentPriceValue) {
                    currentPriceValue.textContent = `₹${price}`;
                } else {
                    priceValue.textContent = `₹${price}`;
                }
            }
            if (submitButton) {
                const submitLabel = submitButton.querySelector("span");
                if (submitLabel) {
                    submitLabel.textContent = `Pay ₹${price} & Confirm`;
                }
            }

            const dateValue = form.querySelector("[data-summary-date]");

            if (dateValue) {
                dateValue.textContent = dateInput?.value || "—";
            }

            const timeValue = form.querySelector("[data-summary-time]");

            if (timeValue) {
                timeValue.textContent = selectedTime || "—";
            }

        }

        function showStep(stepNumber) {

            currentStep = stepNumber;

            steps.forEach(function (step) {
                const isActive = Number(step.dataset.bookingStep) === stepNumber;
                step.classList.toggle("active", isActive);
                step.setAttribute("aria-hidden", String(!isActive));
            });

            indicators.forEach(function (indicator) {
                const indicatorStep = Number(
                    indicator.dataset.bookingStepIndicator
                );
                const isActive = indicatorStep === stepNumber;
                indicator.classList.toggle("active", isActive);

                if (isActive) {
                    indicator.setAttribute("aria-current", "step");
                } else {
                    indicator.removeAttribute("aria-current");
                }
            });

            progressLines.forEach(function (line, index) {
                line.classList.toggle("is-complete", index < stepNumber - 1);
            });

            updateSummary();

        }

        function updateHomeAddressField() {

            const selectedService = form.querySelector(
                "[data-service-type]:checked"
            );
            const isHomeVisit = selectedService?.value === "Home Physiotherapy";

            if (homeAddressField) {
                homeAddressField.hidden = !isHomeVisit;
            }

            if (homeAddressInput) {
                homeAddressInput.required = isHomeVisit;
            }

        }

        function getTimeButtons() {
            return Array.from(
                form.querySelectorAll("[data-time-slot]")
            );
        }

        function formatSlotTime(minutes) {
            const hour = Math.floor(minutes / 60);
            const minute = minutes % 60;
            const period = hour < 12 ? "AM" : "PM";
            const displayHour = hour % 12 || 12;
            return `${String(displayHour).padStart(2, "0")}:${String(minute).padStart(2, "0")} ${period}`;
        }

        function getSlotGroups(serviceType) {
            if (serviceType === "Online Consultation") {
                return [{
                    label: "Online consultation · 24/7",
                    icon: "fa-solid fa-video",
                    times: Array.from({ length: 48 }, (_, index) =>
                        formatSlotTime(index * 30)
                    )
                }];
            }

            return [
                {
                    label: "Morning · 7:00 AM–12:00 PM",
                    icon: "fa-regular fa-sun",
                    times: Array.from({ length: 11 }, (_, index) =>
                        formatSlotTime(7 * 60 + index * 30)
                    )
                },
                {
                    label: "Evening · 6:00 PM–11:00 PM",
                    icon: "fa-regular fa-moon",
                    times: Array.from({ length: 11 }, (_, index) =>
                        formatSlotTime(18 * 60 + index * 30)
                    )
                }
            ];
        }

        function renderTimeSlots(serviceType, bookedTimes, availabilityReady) {
            if (!timeSlotsContainer) return;

            const fragment = document.createDocumentFragment();
            getSlotGroups(serviceType).forEach(function (group) {
                const groupElement = document.createElement("div");
                groupElement.className = "time-group";

                const title = document.createElement("div");
                title.className = "time-group__title";
                const icon = document.createElement("i");
                icon.className = group.icon;
                icon.setAttribute("aria-hidden", "true");
                const label = document.createElement("span");
                label.textContent = group.label;
                title.append(icon, label);

                const grid = document.createElement("div");
                grid.className = "time-slot-grid";

                group.times.forEach(function (time) {
                    const isBooked = bookedTimes.has(time);
                    const button = document.createElement("button");
                    button.type = "button";
                    button.className = "time-slot";
                    button.dataset.timeSlot = time;
                    button.disabled = !availabilityReady || isBooked;
                    button.setAttribute("aria-pressed", "false");
                    if (isBooked) {
                        button.classList.add("is-booked");
                        button.setAttribute("aria-label", `${time}, booked`);
                        button.textContent = `${time} · Booked`;
                    } else {
                        button.textContent = time;
                    }
                    grid.append(button);
                });

                groupElement.append(title, grid);
                fragment.append(groupElement);
            });
            timeSlotsContainer.replaceChildren(fragment);
        }

        function clinicToday() {
            const dateParts = new Intl.DateTimeFormat("en-CA", {
                timeZone: "Asia/Kolkata",
                year: "numeric",
                month: "2-digit",
                day: "2-digit"
            }).formatToParts(new Date());
            const values = Object.fromEntries(
                dateParts.map(function (part) {
                    return [part.type, part.value];
                })
            );
            return `${values.year}-${values.month}-${values.day}`;
        }

        async function updateAvailability() {
            const requestId = ++availabilityRequestId;
            const selectedService = form.querySelector(
                "[data-service-type]:checked"
            );
            const serviceType = selectedService?.value || "Clinic Consultation";
            const appointmentDate = dateInput?.value || "";

            selectedTime = "";
            if (selectedTimeField) selectedTimeField.value = "";
            updateSummary();

            if (serviceType === "Online Consultation") {
                if (timeHelp) timeHelp.textContent = "24/7 availability · slots every 30 minutes.";
            } else if (timeHelp) {
                timeHelp.textContent = "Clinic and home-visit slots · 7:00 AM–12:00 PM and 6:00 PM–11:00 PM.";
            }

            if (!appointmentDate) {
                renderTimeSlots(serviceType, new Set(), false);
                if (timeStatus) timeStatus.textContent = "Select a date";
                return;
            }

            renderTimeSlots(serviceType, new Set(), false);
            if (timeStatus) timeStatus.textContent = "Loading availability…";

            const apiBase = getAppointmentApiBase();
            const query = new URLSearchParams({
                date: appointmentDate,
                service_type: serviceType
            });

            try {
                const response = await fetch(
                    `${apiBase}/api/appointment/availability?${query.toString()}`
                );
                const result = await response.json().catch(function () {
                    return {};
                });
                if (!response.ok || !result.success || !Array.isArray(result.booked_times)) {
                    throw new Error(result.message || "Unable to load appointment availability");
                }
                if (requestId !== availabilityRequestId) return;

                const bookedTimes = new Set(result.booked_times);
                const slotCount = getSlotGroups(serviceType).reduce(
                    (total, group) => total + group.times.length,
                    0
                );
                renderTimeSlots(serviceType, bookedTimes, true);
                if (timeStatus) {
                    timeStatus.textContent =
                        `${slotCount - bookedTimes.size} available · ${bookedTimes.size} booked`;
                }
            } catch (error) {
                if (requestId !== availabilityRequestId) return;
                console.error("Appointment availability request failed:", error);
                const knownBookedTimes = serviceType === "Online Consultation"
                    ? new Set()
                    : new Set(["11:00 AM", "11:30 AM", "12:00 PM"]);
                renderTimeSlots(serviceType, knownBookedTimes, true);
                if (timeStatus) {
                    timeStatus.textContent = "Live availability unavailable. You can choose a slot; it will be checked before payment.";
                }
            }
        }

        if (dateInput) {
            dateInput.min = clinicToday();
        }

        form.addEventListener("click", function (event) {

            const nextButton = event.target.closest("[data-next-step]");
            const previousButton = event.target.closest("[data-prev-step]");

            if (nextButton) {
                const nextStep = Number(nextButton.dataset.nextStep);

                if (nextStep === 2) {
                    updateHomeAddressField();

                    if (homeAddressInput?.required && !homeAddressInput.value.trim()) {
                        homeAddressInput.focus();
                        homeAddressInput.reportValidity();
                        return;
                    }
                }

                if (nextStep === 3) {
                    if (!dateInput?.value) {
                        dateInput?.focus();
                        dateInput?.reportValidity();
                        return;
                    }

                    if (!selectedTime) {
                        if (timeStatus) {
                            timeStatus.textContent = "Choose a time slot";
                        }

                        getTimeButtons()[0]?.focus();
                        return;
                    }
                }

                showStep(nextStep);
                return;
            }

            if (previousButton) {
                showStep(Number(previousButton.dataset.prevStep));
                return;
            }

            const timeButton = event.target.closest("[data-time-slot]");

            if (!timeButton || timeButton.disabled) {
                return;
            }

            selectedTime = timeButton.dataset.timeSlot;
            if (selectedTimeField) selectedTimeField.value = selectedTime;

            getTimeButtons().forEach(function (slot) {
                const isSelected = slot === timeButton;
                slot.classList.toggle("selected", isSelected);
                slot.setAttribute("aria-pressed", String(isSelected));
            });

            if (timeStatus) {
                timeStatus.textContent = `Selected: ${selectedTime}`;
            }

            updateSummary();

        });

        form.addEventListener("change", function (event) {

            if (event.target.matches("[data-service-type]")) {
                updateHomeAddressField();
                updateAvailability();
            }

            if (event.target.matches("[data-appointment-date]")) {
                updateAvailability();

            }

        });

        updateHomeAddressField();
        showStep(1);
        updateAvailability();

    }

    function initializeAppointmentForms() {

        const forms =
            document.querySelectorAll(
                "form[data-appointment-form]"
            );


        forms.forEach(
            function (form) {

                form.addEventListener(
                    "submit",
                    async function (event) {
                        event.preventDefault();

                        const status =
                            form.querySelector(
                                "[data-form-status]"
                            );

                        const submitButton =
                            form.querySelector("[data-booking-submit]");
                        const showStatus = function (message) {
                            if (!status) return;
                            status.textContent = message;
                            status.classList.add("is-visible");
                        };

                        if (!form.reportValidity()) {
                            return;
                        }

                        if (typeof window.Razorpay !== "function") {
                            showStatus(
                                "Secure payment could not be loaded. Refresh the page and try again."
                            );
                            return;
                        }

                        const values = new FormData(form);
                        const requestBody = {
                            full_name: String(values.get("patientName") || "").trim(),
                            phone: String(values.get("patientPhone") || "").trim(),
                            whatsapp_confirmation_consent:
                                values.get("whatsappConfirmationConsent") === "yes",
                            email: String(values.get("patientEmail") || "").trim(),
                            age: String(values.get("patientAge") || "").trim() || null,
                            address: String(values.get("patientAddress") || "").trim(),
                            appointment_reason: String(
                                values.get("appointmentReason") || ""
                            ).trim(),
                            service_type: String(values.get("serviceType") || ""),
                            appointment_date: String(
                                values.get("appointmentDate") || ""
                            ),
                            appointment_time: String(
                                values.get("appointmentTime") || ""
                            )
                        };

                        const apiBase = getAppointmentApiBase();

                        if (submitButton) submitButton.disabled = true;
                        showStatus("Saving your appointment and preparing secure payment…");

                        try {
                            const orderResponse = await fetch(
                                `${apiBase}/api/appointment/payment-order`,
                                {
                                    method: "POST",
                                    headers: {
                                        "Content-Type": "application/json"
                                    },
                                    body: JSON.stringify(requestBody)
                                }
                            );
                            const responseText = await orderResponse.text();
                            let orderData = {};

                            if (responseText) {
                                try {
                                    orderData = JSON.parse(responseText);
                                } catch {
                                    orderData = {};
                                }
                            }

                            if (!orderResponse.ok || !orderData.success) {
                                throw new Error(
                                    typeof orderData.message === "string"
                                        ? `Payment setup failed (HTTP ${orderResponse.status}): ${orderData.message}`
                                        : `Payment setup failed (HTTP ${orderResponse.status}). The server returned an unexpected response; please try again or call the clinic.`
                                );
                            }

                            const checkout = new window.Razorpay({
                                key: orderData.key_id,
                                amount: orderData.order.amount,
                                currency: orderData.order.currency,
                                name: "Dr. Vishal Yogi Physiotherapy",
                                description: requestBody.service_type,
                                order_id: orderData.order.id,
                                prefill: {
                                    name: requestBody.full_name,
                                    email: requestBody.email,
                                    contact: requestBody.phone
                                },
                                theme: {
                                    color: "#17616b"
                                },
                                handler: async function (paymentDetails) {
                                    showStatus(
                                        "Payment received. Confirming your appointment…"
                                    );
                                    try {
                                        const confirmationResponse = await fetch(
                                            `${apiBase}/api/appointment/payment-complete`,
                                            {
                                                method: "POST",
                                                headers: {
                                                    "Content-Type": "application/json"
                                                },
                                                body: JSON.stringify({
                                                    booking_id: orderData.booking_id,
                                                    razorpay_order_id:
                                                        paymentDetails.razorpay_order_id,
                                                    razorpay_payment_id:
                                                        paymentDetails.razorpay_payment_id,
                                                    razorpay_signature:
                                                        paymentDetails.razorpay_signature
                                                })
                                            }
                                        );
                                        const confirmation =
                                            await confirmationResponse.json().catch(
                                                function () {
                                                    return {};
                                                }
                                            );
                                        if (
                                            !confirmationResponse.ok ||
                                            !confirmation.success
                                        ) {
                                            throw new Error(
                                                confirmation.message ||
                                                "Payment could not be confirmed"
                                            );
                                        }

                                        sessionStorage.setItem(
                                            "vyAppointmentReceipt",
                                            JSON.stringify({
                                                ...confirmation,
                                                service_type: requestBody.service_type,
                                                appointment_date:
                                                    requestBody.appointment_date,
                                                appointment_time:
                                                    requestBody.appointment_time
                                            })
                                        );
                                        window.location.assign(
                                            "appointment-thank-you.html"
                                        );
                                    } catch (error) {
                                        showStatus(
                                            `${error.message}. Do not pay again; contact the clinic with your Razorpay receipt.`
                                        );
                                        if (submitButton) {
                                            submitButton.disabled = false;
                                        }
                                    }
                                },
                                modal: {
                                    ondismiss: function () {
                                        showStatus(
                                            "Payment was not completed. Your request is saved; you can try again."
                                        );
                                        if (submitButton) {
                                            submitButton.disabled = false;
                                        }
                                    }
                                }
                            });

                            checkout.on("payment.failed", function (event) {
                                showStatus(
                                    event.error?.description ||
                                    "Payment did not complete. You can submit the appointment again to retry."
                                );
                                if (submitButton) {
                                    submitButton.disabled = false;
                                }
                            });
                            checkout.open();
                        } catch (error) {
                            if (error instanceof TypeError) {
                                showStatus(
                                    `Could not reach the appointment payment server at ${apiBase || window.location.origin}. Make sure the backend is running and try again.`
                                );
                            } else {
                                showStatus(error.message);
                            }
                            if (submitButton) submitButton.disabled = false;
                        }

                    }
                );

            }
        );

    }


    /* =====================================================
       DATE MINIMUM FOR APPOINTMENT FORMS
       ===================================================== */

    function initializeDateInputs() {

        const dateInputs =
            document.querySelectorAll(
                'input[type="date"]'
            );


        if (!dateInputs.length) {
            return;
        }


        const today =
            new Date();


        const year =
            today.getFullYear();


        const month =
            String(
                today.getMonth() + 1
            ).padStart(
                2,
                "0"
            );


        const day =
            String(
                today.getDate()
            ).padStart(
                2,
                "0"
            );


        const minimumDate =
            `${year}-${month}-${day}`;


        dateInputs.forEach(
            function (input) {

                if (
                    !input.hasAttribute(
                        "min"
                    )
                ) {

                    input.min =
                        minimumDate;

                }

            }
        );

    }


    /* =====================================================
       FORM FIELD FOCUS
       ===================================================== */

    function initializeFormFields() {

        const fields =
            document.querySelectorAll(
                "input, textarea, select"
            );


        fields.forEach(
            function (field) {

                field.addEventListener(
                    "focus",
                    function () {

                        field
                            .closest(
                                ".form-field, .input-group"
                            )
                            ?.classList.add(
                                "is-focused"
                            );

                    }
                );


                field.addEventListener(
                    "blur",
                    function () {

                        field
                            .closest(
                                ".form-field, .input-group"
                            )
                            ?.classList.remove(
                                "is-focused"
                            );

                    }
                );

            }
        );

    }


    /* =====================================================
       ONLINE / HOME / CLINIC CARE SELECTOR
       ===================================================== */

    function initializeCareSelector() {

        const selectors =
            document.querySelectorAll(
                "[data-care-selector]"
            );


        selectors.forEach(
            function (selector) {

                const buttons =
                    selector.querySelectorAll(
                        "[data-care-option]"
                    );


                const panels =
                    selector.querySelectorAll(
                        "[data-care-panel]"
                    );


                buttons.forEach(
                    function (button) {

                        button.addEventListener(
                            "click",
                            function () {

                                const option =
                                    button.dataset.careOption;


                                buttons.forEach(
                                    function (item) {

                                        item.classList.toggle(
                                            "active",
                                            item ===
                                            button
                                        );

                                    }
                                );


                                panels.forEach(
                                    function (panel) {

                                        panel.classList.toggle(
                                            "active",
                                            panel.dataset.carePanel ===
                                            option
                                        );

                                    }
                                );

                            }
                        );

                    }
                );

            }
        );

    }


    /* =====================================================
       TOOLTIP SYSTEM
       ===================================================== */

    function initializeTooltips() {

        const elements =
            document.querySelectorAll(
                "[data-tooltip]"
            );


        elements.forEach(
            function (element) {

                element.setAttribute(
                    "aria-label",
                    element.dataset.tooltip
                );

            }
        );

    }


    /* =====================================================
       CONNECTION STATUS
       ===================================================== */

    function initializeConnectionStatus() {

        const elements =
            document.querySelectorAll(
                "[data-connection-status]"
            );


        if (!elements.length) {
            return;
        }


        function updateStatus() {

            const online =
                navigator.onLine;


            elements.forEach(
                function (element) {

                    element.textContent =
                        online
                            ? "Online"
                            : "Offline";


                    element.classList.toggle(
                        "is-online",
                        online
                    );


                    element.classList.toggle(
                        "is-offline",
                        !online
                    );

                }
            );

        }


        window.addEventListener(
            "online",
            updateStatus
        );


        window.addEventListener(
            "offline",
            updateStatus
        );


        updateStatus();

    }


    /* =====================================================
       GLOBAL ERROR SAFETY
       ===================================================== */

    function initializeErrorSafety() {

        window.addEventListener(
            "error",
            function (event) {

                /*
                 * Keep UI functional even if an optional
                 * media resource fails.
                 */

                if (
                    event.target instanceof
                    HTMLImageElement
                ) {

                    event.target.classList.add(
                        "asset-error"
                    );

                }

            },
            true
        );

    }


    /* =====================================================
       PAGE VISIBILITY
       ===================================================== */

    function initializeVisibilityHandling() {

        document.addEventListener(
            "visibilitychange",
            function () {

                const videos =
                    document.querySelectorAll(
                        "video"
                    );


                if (
                    document.hidden
                ) {

                    videos.forEach(
                        function (video) {

                            if (
                                !video.paused
                            ) {

                                video.dataset.wasPlaying =
                                    "true";

                                video.pause();

                            }

                        }
                    );

                } else {

                    videos.forEach(
                        function (video) {

                            if (
                                video.dataset.wasPlaying ===
                                "true"
                            ) {

                                delete video.dataset.wasPlaying;

                            }

                        }
                    );

                }

            }
        );

    }


    /* =====================================================
       GLOBAL INITIALIZATION
       ===================================================== */

    function initializeEverything() {

        initializePageLoader();

        initializeCurrentYear();

        initializeClinicData();

        initializeWhatsApp();

        initializeCallButtons();

        initializeMapButtons();

        initializeFAQ();

        initializeAccordions();

        initializeVideos();

        initializeBackToTop();

        initializeButtonRipple();

        initializeExternalLinks();

        initializeImageFallbacks();

        initializeNativeLazyLoading();

        initializeSectionTracking();

        initializeCopyButtons();
        initializeDynamicActions();
        initializeAssistanceDialog();
        initializeHoverState();

        initializeContactForms();

        initializeAppointmentForms();

        initializeDateInputs();

        initializeBookingWizard();

        initializeFormFields();

        initializeCareSelector();

        initializeTooltips();

        initializeConnectionStatus();

        initializeErrorSafety();

        initializeVisibilityHandling();

    }


    /* =====================================================
       BOOT
       ===================================================== */

    ready(
        initializeEverything
    );


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.DrVishalClinic = {

        config: CONFIG,

        whatsapp: openWhatsApp,

        call: function () {

            window.location.href =
                `tel:+91${CONFIG.phone}`;

        },

        maps: function () {

            window.open(
                CONFIG.maps,
                "_blank",
                "noopener,noreferrer"
            );

        }

    };

})();