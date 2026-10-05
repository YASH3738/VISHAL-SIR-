/* =========================================================
   DR. VISHAL YOGI CLINIC
   PREMIUM GALLERY ENGINE
   ========================================================= */

(function () {
    "use strict";


    /* =====================================================
       CONFIG
       ===================================================== */

    const CONFIG = {
        animationDuration: 300,
        swipeThreshold: 60,
        selector: ".gallery-item",
        filterSelector: "[data-gallery-filter]"
    };

    const GALLERY_IMAGES = [
        "logog vishal sr.jpeg",
        "vishal yogi.jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.24.jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.25.jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.26.jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.27.jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.28.jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.29.jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.30.jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.31.jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.32 (1).jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.32.jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.33 (1).jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.33.jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.34.jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.35 (1).jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.35.jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.46.jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.50.jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.52.jpeg",
        "WhatsApp Image 2026-09-29 at 22.42.57.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.03.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.04 (1).jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.04.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.05 (1).jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.05 (2).jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.05.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.06 (1).jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.06.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.07 (1).jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.07 (2).jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.07.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.08 (1).jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.08.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.09 (1).jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.09.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.10 (1).jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.10.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.11 (1).jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.11.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.12.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.13.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.21.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.25.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.27.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.28.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.30.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.31.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.33.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.50.jpeg",
        "WhatsApp Image 2026-09-29 at 22.43.59.jpeg",
        "WhatsApp Image 2026-09-29 at 22.44.04.jpeg"
    ];

    const NEW_GALLERY_IMAGES = [
        {
            filename: "WhatsApp Image 2026-10-04 at 22.32.24.jpeg",
            title: "Excellence in Clinical Award 2025",
            alt: "Excellence in Clinical Award 2025 certificate"
        },
        {
            filename: "WhatsApp Image 2026-10-04 at 22.32.25.jpeg",
            title: "National Physio Icon Award 2025",
            alt: "National Physio Icon Award 2025 presented to Dr. Vishal Yogi"
        },
        {
            filename: "WhatsApp Image 2026-10-04 at 22.32.25 (1).jpeg",
            title: "Youth Physio Award 2024",
            alt: "Framed Youth Physio Award 2024"
        },
        {
            filename: "WhatsApp Image 2026-10-04 at 22.32.25 (2).jpeg",
            title: "Post-Operative Rehabilitation",
            alt: "Physiotherapy rehabilitation session in a hospital setting"
        },
        {
            filename: "WhatsApp Image 2026-10-04 at 22.32.26.jpeg",
            title: "Sports Physiotherapy",
            alt: "Dr. Vishal Yogi with a sports player"
        },
        {
            filename: "WhatsApp Image 2026-10-04 at 22.32.26 (1).jpeg",
            title: "Sports Community",
            alt: "Dr. Vishal Yogi with a cricketer"
        },
        {
            filename: "WhatsApp Image 2026-10-04 at 22.32.26 (2).jpeg",
            title: "Professional Journey",
            alt: "Dr. Vishal Yogi in Manipal Hospital scrubs"
        },
        {
            filename: "WhatsApp Image 2026-10-04 at 22.32.27.jpeg",
            title: "Professional Recognition",
            alt: "Dr. Vishal Yogi at an award ceremony"
        },
        {
            filename: "WhatsApp Image 2026-10-04 at 22.32.27 (1).jpeg",
            title: "Award Presentation",
            alt: "Dr. Vishal Yogi receiving an award on stage"
        },
        {
            filename: "WhatsApp Image 2026-10-04 at 22.32.28.jpeg",
            title: "Recognition and Appreciation",
            alt: "Dr. Vishal Yogi at a professional recognition event"
        },
        {
            filename: "WhatsApp Image 2026-10-04 at 22.32.28 (1).jpeg",
            title: "Award Ceremony",
            alt: "Dr. Vishal Yogi at a conference and award ceremony"
        },
        {
            filename: "WhatsApp Image 2026-10-04 at 22.32.28 (2).jpeg",
            title: "Cupping Therapy",
            alt: "Cupping therapy being provided during a treatment session"
        },
        {
            filename: "WhatsApp Image 2026-10-04 at 22.32.28 (3).jpeg",
            title: "Sports Event",
            alt: "Dr. Vishal Yogi at an outdoor sports event"
        },
        {
            filename: "WhatsApp Image 2026-10-04 at 22.32.29.jpeg",
            title: "Sports Care",
            alt: "Dr. Vishal Yogi with a sports professional"
        }
    ];


    /* =====================================================
       STATE
       ===================================================== */

    let galleryItems = [];
    let visibleItems = [];

    let currentIndex = 0;

    let lightbox = null;

    let lightboxImage = null;
    let lightboxVideo = null;
    let lightboxTitle = null;
    let lightboxCategory = null;
    let lightboxCounter = null;

    let touchStartX = 0;
    let touchStartY = 0;


    /* =====================================================
       INITIALIZE
       ===================================================== */

    function initializeGallery() {

        renderAssetGallery();

        galleryItems = Array.from(
            document.querySelectorAll(
                CONFIG.selector
            )
        );


        if (!galleryItems.length) {
            return;
        }


        visibleItems =
            galleryItems.slice();


        createLightbox();

        setupFilters();

        setupGalleryItems();

        setupKeyboardControls();

        setupTouchControls();

    }


    function renderAssetGallery() {

        const grid = document.querySelector("[data-gallery-grid]");

        if (!grid) {
            return;
        }

        const fragment = document.createDocumentFragment();

        const images = [
            ...GALLERY_IMAGES.map(function (filename) {
                return {
                    filename: filename,
                    source: "assets/" + encodeURIComponent(filename),
                    title: "Photo",
                    alt: "Gallery photo"
                };
            }),
            ...NEW_GALLERY_IMAGES.map(function (image) {
                return {
                    ...image,
                    source: "assets/new/" + encodeURIComponent(image.filename)
                };
            })
        ];

        images.forEach(function (imageData, index) {

            const number = String(index + 1).padStart(2, "0");
            const source = imageData.source;
            const title = imageData.title === "Photo"
                ? "Photo " + number
                : imageData.title;
            const item = document.createElement("article");
            item.className = "gallery-item";
            item.dataset.galleryItem = "";
            item.dataset.category = "photos";
            item.dataset.type = "image";
            item.dataset.src = source;
            item.dataset.title = title;

            const media = document.createElement("div");
            media.className = "gallery-item__media";

            const image = document.createElement("img");
            image.src = source;
            image.alt = imageData.title === "Photo"
                ? "Gallery photo " + number
                : imageData.alt;
            image.loading = "lazy";
            image.dataset.full = source;
            media.appendChild(image);

            const overlay = document.createElement("div");
            overlay.className = "gallery-item__overlay";
            overlay.innerHTML = `
                <span>Photo</span>
                <button type="button" class="gallery-item__open" aria-label="Open photo ${number}" data-gallery-open>
                    <i class="fa-solid fa-expand" aria-hidden="true"></i>
                </button>
            `;
            media.appendChild(overlay);

            const caption = document.createElement("div");
            caption.className = "gallery-item__caption";
            caption.innerHTML = `<span>${number}</span><h3>${title}</h3>`;

            item.append(media, caption);
            fragment.appendChild(item);
        });

        grid.replaceChildren(fragment);

    }


    /* =====================================================
       GET ITEM DATA
       ===================================================== */

    function getItemData(item) {

        const media =
            item.querySelector(
                "img, video"
            );


        const image =
            item.querySelector(
                "img"
            );


        const video =
            item.querySelector(
                "video"
            );


        const title =
            item.dataset.title ||
            item.querySelector(
                "[data-gallery-title]"
            )?.textContent ||
            "";


        const category =
            item.dataset.category ||
            "";


        let source = "";


        if (image) {

            source =
                image.dataset.full ||
                image.dataset.src ||
                image.currentSrc ||
                image.src ||
                "";

        }


        if (
            video &&
            !source
        ) {

            source =
                video.dataset.full ||
                video.dataset.src ||
                video.currentSrc ||
                video.src ||
                "";

        }


        const poster =
            video?.poster ||
            image?.src ||
            "";


        const type =
            item.dataset.type ||
            (
                video
                    ? "video"
                    : "image"
            );


        return {
            element: item,
            media,
            image,
            video,
            title,
            category,
            source,
            poster,
            type
        };

    }


    /* =====================================================
       CREATE LIGHTBOX
       ===================================================== */

    function createLightbox() {

        if (
            document.querySelector(
                ".gallery-lightbox"
            )
        ) {

            lightbox =
                document.querySelector(
                    ".gallery-lightbox"
                );

        } else {

            lightbox =
                document.createElement(
                    "div"
                );

            lightbox.className =
                "gallery-lightbox";

            lightbox.setAttribute(
                "aria-hidden",
                "true"
            );


            lightbox.innerHTML = `
                <div class="gallery-lightbox-backdrop"></div>

                <div
                    class="gallery-lightbox-dialog"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Gallery preview"
                >

                    <button
                        class="gallery-lightbox-close"
                        type="button"
                        aria-label="Close gallery"
                    >
                        <i class="fa-solid fa-xmark"></i>
                    </button>

                    <button
                        class="gallery-lightbox-prev"
                        type="button"
                        aria-label="Previous image"
                    >
                        <i class="fa-solid fa-chevron-left"></i>
                    </button>

                    <div class="gallery-lightbox-media">

                        <div
                            class="gallery-lightbox-loader"
                            aria-hidden="true"
                        >
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>

                        <img
                            class="gallery-lightbox-image"
                            alt=""
                        >

                        <video
                            class="gallery-lightbox-video"
                            controls
                            playsinline
                            preload="metadata"
                        ></video>

                    </div>

                    <button
                        class="gallery-lightbox-next"
                        type="button"
                        aria-label="Next image"
                    >
                        <i class="fa-solid fa-chevron-right"></i>
                    </button>

                    <div class="gallery-lightbox-info">

                        <div
                            class="gallery-lightbox-category"
                        ></div>

                        <h3
                            class="gallery-lightbox-title"
                        ></h3>

                        <div
                            class="gallery-lightbox-counter"
                        ></div>

                    </div>

                </div>
            `;


            document.body.appendChild(
                lightbox
            );

        }


        const media =
            lightbox.querySelector(
                ".gallery-lightbox-media, [data-gallery-media]"
            );


        lightboxImage =
            lightbox.querySelector(
                ".gallery-lightbox-image"
            );


        if (!lightboxImage && media) {

            lightboxImage =
                document.createElement("img");

            lightboxImage.className =
                "gallery-lightbox-image";

            lightboxImage.alt = "";

            media.appendChild(lightboxImage);

        }


        lightboxVideo =
            lightbox.querySelector(
                ".gallery-lightbox-video"
            );


        if (!lightboxVideo && media) {

            lightboxVideo =
                document.createElement("video");

            lightboxVideo.className =
                "gallery-lightbox-video";

            lightboxVideo.controls = true;

            lightboxVideo.playsInline = true;

            lightboxVideo.preload = "metadata";

            media.appendChild(lightboxVideo);

        }

        media
            ?.querySelector(".gallery-lightbox__placeholder")
            ?.remove();


        lightboxTitle =
            lightbox.querySelector(
                ".gallery-lightbox-title, [data-gallery-title]"
            );


        lightboxCategory =
            lightbox.querySelector(
                ".gallery-lightbox-category, [data-gallery-category]"
            );


        lightboxCounter =
            lightbox.querySelector(
                ".gallery-lightbox-counter, [data-gallery-counter]"
            );


        const closeButton =
            lightbox.querySelector(
                ".gallery-lightbox-close, [data-gallery-close]"
            );


        const backdrop =
            lightbox.querySelector(
                ".gallery-lightbox-backdrop, .gallery-lightbox__backdrop"
            );


        const previousButton =
            lightbox.querySelector(
                ".gallery-lightbox-prev, [data-gallery-prev]"
            );


        const nextButton =
            lightbox.querySelector(
                ".gallery-lightbox-next, [data-gallery-next]"
            );


        closeButton?.addEventListener(
            "click",
            closeLightbox
        );


        backdrop?.addEventListener(
            "click",
            closeLightbox
        );


        previousButton?.addEventListener(
            "click",
            showPrevious
        );


        nextButton?.addEventListener(
            "click",
            showNext
        );

    }


    /* =====================================================
       SETUP GALLERY ITEMS
       ===================================================== */

    function setupGalleryItems() {

        galleryItems.forEach(
            function (item) {

                const trigger =
                    item.querySelector(
                        "[data-gallery-open]"
                    );


                const target =
                    trigger ||
                    item;


                target.addEventListener(
                    "click",
                    function (event) {

                        /*
                         * Don't interfere with actual links
                         * or buttons inside gallery cards.
                         */

                        const interactive =
                            event.target.closest(
                                "a, button"
                            );


                        if (
                            interactive &&
                            interactive !== target &&
                            !interactive.hasAttribute(
                                "data-gallery-open"
                            )
                        ) {
                            return;
                        }


                        event.preventDefault();


                        const index =
                            visibleItems.indexOf(
                                item
                            );


                        if (index === -1) {
                            return;
                        }


                        openLightbox(index);

                    }
                );

            }
        );

    }


    /* =====================================================
       FILTER SYSTEM
       ===================================================== */

    function setupFilters() {

        const filters =
            document.querySelectorAll(
                CONFIG.filterSelector
            );


        if (!filters.length) {
            return;
        }


        filters.forEach(
            function (filter) {

                filter.addEventListener(
                    "click",
                    function () {

                        const category =
                            filter.dataset.galleryFilter ||
                            filter.getAttribute(
                                "data-gallery-filter"
                            );


                        filters.forEach(
                            function (button) {

                                button.classList.remove(
                                    "active"
                                );

                            }
                        );


                        filter.classList.add(
                            "active"
                        );


                        filterGallery(
                            category
                        );

                    }
                );

            }
        );

    }


    function filterGallery(category) {

        if (
            !category ||
            category === "all" ||
            category === "*"
        ) {

            visibleItems =
                galleryItems.slice();

        } else {

            visibleItems =
                galleryItems.filter(
                    function (item) {

                        const itemCategory =
                            item.dataset.category ||
                            "";


                        return (
                            itemCategory
                                .toLowerCase() ===
                            category.toLowerCase()
                        );

                    }
                );

        }


        galleryItems.forEach(
            function (item) {

                const shouldShow =
                    visibleItems.includes(
                        item
                    );


                if (shouldShow) {

                    item.classList.remove(
                        "gallery-hidden"
                    );

                    item.removeAttribute(
                        "aria-hidden"
                    );

                } else {

                    item.classList.add(
                        "gallery-hidden"
                    );

                    item.setAttribute(
                        "aria-hidden",
                        "true"
                    );

                }

            }
        );


        /*
         * Reset lightbox index.
         */

        currentIndex = 0;

    }


    /* =====================================================
       OPEN LIGHTBOX
       ===================================================== */

    function openLightbox(index) {

        if (
            !visibleItems.length ||
            !lightbox
        ) {
            return;
        }


        currentIndex =
            Math.max(
                0,
                Math.min(
                    index,
                    visibleItems.length - 1
                )
            );


        renderLightboxItem();


        lightbox.classList.add(
            "is-open"
        );


        lightbox.setAttribute(
            "aria-hidden",
            "false"
        );


        document.body.classList.add(
            "gallery-open"
        );


        document.body.style.overflow =
            "hidden";


        /*
         * Focus close button for accessibility.
         */

        const closeButton =
            lightbox.querySelector(
                ".gallery-lightbox-close"
            );


        setTimeout(
            function () {

                closeButton?.focus();

            },
            50
        );

    }


    /* =====================================================
       RENDER LIGHTBOX ITEM
       ===================================================== */

    function renderLightboxItem() {

        const item =
            visibleItems[currentIndex];


        if (!item) {
            return;
        }


        const data =
            getItemData(item);


        /*
         * Reset media.
         */

        if (lightboxImage) {

            lightboxImage.classList.remove(
                "is-loaded"
            );

            lightboxImage.style.display =
                "none";

        }


        if (lightboxVideo) {

            lightboxVideo.pause();

            lightboxVideo.removeAttribute(
                "src"
            );

            lightboxVideo.load();

            lightboxVideo.style.display =
                "none";

        }


        lightbox.classList.add(
            "is-loading"
        );


        /*
         * Text.
         */

        if (lightboxTitle) {

            lightboxTitle.textContent =
                data.title;

        }


        if (lightboxCategory) {

            lightboxCategory.textContent =
                data.category;

        }


        if (lightboxCounter) {

            lightboxCounter.textContent =
                `${currentIndex + 1} / ${visibleItems.length}`;

        }


        /*
         * Video.
         */

        if (
            data.type === "video" &&
            data.source
        ) {

            lightboxVideo.style.display =
                "block";


            lightboxVideo.src =
                data.source;


            if (data.poster) {

                lightboxVideo.poster =
                    data.poster;

            }


            lightboxVideo.addEventListener(
                "loadeddata",
                function handleLoaded() {

                    lightbox.classList.remove(
                        "is-loading"
                    );

                    lightboxVideo.classList.add(
                        "is-loaded"
                    );

                    lightboxVideo.removeEventListener(
                        "loadeddata",
                        handleLoaded
                    );

                }
            );


            return;

        }


        /*
         * Image.
         */

        if (
            lightboxImage &&
            data.source
        ) {

            lightboxImage.style.display =
                "block";


            lightboxImage.alt =
                data.title ||
                "Dr. Vishal Yogi Clinic";


            lightboxImage.onload =
                function () {

                    lightbox.classList.remove(
                        "is-loading"
                    );

                    lightboxImage.classList.add(
                        "is-loaded"
                    );

                };


            lightboxImage.onerror =
                function () {

                    lightbox.classList.remove(
                        "is-loading"
                    );

                    lightboxImage.alt =
                        "Image unavailable";

                };


            lightboxImage.src =
                data.source;

        } else {

            lightbox.classList.remove(
                "is-loading"
            );

        }

    }


    /* =====================================================
       CLOSE LIGHTBOX
       ===================================================== */

    function closeLightbox() {

        if (!lightbox) {
            return;
        }


        lightbox.classList.remove(
            "is-open"
        );


        lightbox.setAttribute(
            "aria-hidden",
            "true"
        );


        document.body.classList.remove(
            "gallery-open"
        );


        document.body.style.overflow =
            "";


        if (lightboxVideo) {

            lightboxVideo.pause();

            lightboxVideo.removeAttribute(
                "src"
            );

            lightboxVideo.load();

        }


        if (lightboxImage) {

            lightboxImage.removeAttribute(
                "src"
            );

        }

    }


    /* =====================================================
       NEXT ITEM
       ===================================================== */

    function showNext() {

        if (!visibleItems.length) {
            return;
        }


        currentIndex =
            (
                currentIndex + 1
            ) %
            visibleItems.length;


        renderLightboxItem();

    }


    /* =====================================================
       PREVIOUS ITEM
       ===================================================== */

    function showPrevious() {

        if (!visibleItems.length) {
            return;
        }


        currentIndex =
            (
                currentIndex -
                1 +
                visibleItems.length
            ) %
            visibleItems.length;


        renderLightboxItem();

    }


    /* =====================================================
       KEYBOARD CONTROLS
       ===================================================== */

    function setupKeyboardControls() {

        document.addEventListener(
            "keydown",
            function (event) {

                if (
                    !lightbox ||
                    !lightbox.classList.contains(
                        "is-open"
                    )
                ) {
                    return;
                }


                switch (event.key) {

                    case "Escape":

                        closeLightbox();

                        break;


                    case "ArrowRight":

                        event.preventDefault();

                        showNext();

                        break;


                    case "ArrowLeft":

                        event.preventDefault();

                        showPrevious();

                        break;

                }

            }
        );

    }


    /* =====================================================
       TOUCH SWIPE
       ===================================================== */

    function setupTouchControls() {

        if (!lightbox) {
            return;
        }


        const media =
            lightbox.querySelector(
                ".gallery-lightbox-media, [data-gallery-media]"
            );


        if (!media) {
            return;
        }


        media.addEventListener(
            "touchstart",
            function (event) {

                const touch =
                    event.changedTouches[0];


                touchStartX =
                    touch.clientX;


                touchStartY =
                    touch.clientY;

            },
            {
                passive: true
            }
        );


        media.addEventListener(
            "touchend",
            function (event) {

                const touch =
                    event.changedTouches[0];


                const deltaX =
                    touch.clientX -
                    touchStartX;


                const deltaY =
                    touch.clientY -
                    touchStartY;


                /*
                 * Ignore mostly vertical gestures.
                 */

                if (
                    Math.abs(deltaX) <
                    Math.abs(deltaY)
                ) {
                    return;
                }


                if (
                    Math.abs(deltaX) <
                    CONFIG.swipeThreshold
                ) {
                    return;
                }


                if (deltaX < 0) {

                    showNext();

                } else {

                    showPrevious();

                }

            },
            {
                passive: true
            }
        );

    }


    /* =====================================================
       IMAGE PRELOADING
       ===================================================== */

    function preloadAdjacent() {

        if (
            visibleItems.length <= 1
        ) {
            return;
        }


        const nextIndex =
            (
                currentIndex + 1
            ) %
            visibleItems.length;


        const previousIndex =
            (
                currentIndex -
                1 +
                visibleItems.length
            ) %
            visibleItems.length;


        [
            nextIndex,
            previousIndex
        ].forEach(
            function (index) {

                const data =
                    getItemData(
                        visibleItems[index]
                    );


                if (
                    data.type === "image" &&
                    data.source
                ) {

                    const image =
                        new Image();

                    image.src =
                        data.source;

                }

            }
        );

    }


    /* =====================================================
       LIGHTBOX NAVIGATION WRAPPER
       ===================================================== */

    const originalShowNext =
        showNext;


    const originalShowPrevious =
        showPrevious;


    showNext = function () {

        originalShowNext();

        preloadAdjacent();

    };


    showPrevious = function () {

        originalShowPrevious();

        preloadAdjacent();

    };


    /* =====================================================
       VIDEO AUTOPLAY SUPPORT
       ===================================================== */

    document.addEventListener(
        "play",
        function (event) {

            const video =
                event.target;


            if (
                !video.matches(
                    ".gallery-lightbox-video"
                )
            ) {
                return;
            }


            /*
             * Only one gallery video at a time.
             */

            document
                .querySelectorAll(
                    ".gallery-lightbox-video"
                )
                .forEach(
                    function (otherVideo) {

                        if (
                            otherVideo !== video
                        ) {

                            otherVideo.pause();

                        }

                    }
                );

        },
        true
    );


    /* =====================================================
       BOOT
       ===================================================== */

    function bootGallery() {

        initializeGallery();

    }


    if (
        document.readyState ===
        "loading"
    ) {

        document.addEventListener(
            "DOMContentLoaded",
            bootGallery
        );

    } else {

        bootGallery();

    }


    /* =====================================================
       PUBLIC API
       ===================================================== */

    window.DrVishalGallery = {

        open: openLightbox,

        close: closeLightbox,

        next: showNext,

        previous: showPrevious,

        filter: filterGallery,

        refresh: function () {

            galleryItems =
                Array.from(
                    document.querySelectorAll(
                        CONFIG.selector
                    )
                );

            visibleItems =
                galleryItems.slice();

        }

    };

})();