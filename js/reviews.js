(function () {
    "use strict";

    const filterButtons = Array.from(
        document.querySelectorAll("[data-review-filter]")
    );
    const reviewCards = Array.from(
        document.querySelectorAll("[data-review-category]")
    );
    const results = document.querySelector("[data-review-results]");

    if (!filterButtons.length || !reviewCards.length || !results) {
        return;
    }

    function applyFilter(filter) {
        let visibleCount = 0;

        reviewCards.forEach(function (card) {
            const matches =
                filter === "all" ||
                card.dataset.reviewCategory === filter;

            card.hidden = !matches;
            visibleCount += matches ? 1 : 0;
        });

        results.textContent =
            "Showing " + visibleCount + " patient stories";
    }

    filterButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            const selectedFilter = button.dataset.reviewFilter;

            filterButtons.forEach(function (filterButton) {
                const isSelected =
                    filterButton === button;

                filterButton.classList.toggle(
                    "is-active",
                    isSelected
                );
                filterButton.setAttribute(
                    "aria-pressed",
                    String(isSelected)
                );
            });

            applyFilter(selectedFilter);
        });
    });

    applyFilter("all");
})();
