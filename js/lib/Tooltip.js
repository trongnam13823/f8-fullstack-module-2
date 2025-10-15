export default class Tooltip {
    constructor(options = {}) {
        this.options = {
            delay: options.delay || 150,
            offset: options.offset || 8,
        };

        this.tooltipEl = document.createElement("div");
        this.tooltipEl.className = "tooltip";
        document.body.appendChild(this.tooltipEl);

        this.activeTarget = null;
        this.hideTimeout = null;

        this.bindEvents();
    }

    bindEvents() {
        document.addEventListener("mouseover", (e) => {
            const target = e.target.closest("[data-tooltip]");
            if (!target) return;

            const text = target.getAttribute("data-tooltip");
            if (!text) return;

            clearTimeout(this.hideTimeout);
            this.activeTarget = target;
            this.showTooltip(text, target);
        });

        document.addEventListener("mouseout", (e) => {
            if (!this.activeTarget) return;

            const related = e.relatedTarget;
            if (this.activeTarget.contains(related)) return;

            this.hideTimeout = setTimeout(() => this.hideTooltip(), this.options.delay);
        });
    }

    showTooltip(text, target) {
        this.tooltipEl.textContent = text;
        this.tooltipEl.style.opacity = "1";
        this.tooltipEl.style.pointerEvents = "none";

        const rect = target.getBoundingClientRect();
        const tooltipRect = this.tooltipEl.getBoundingClientRect();
        const placement = target.getAttribute("data-placement") || "top";
        const offset = this.options.offset;

        let top = 0,
            left = 0;

        switch (placement) {
            // ==== TOP POSITIONS ====
            case "top":
                top = rect.top - tooltipRect.height - offset + window.scrollY;
                left = rect.left + (rect.width - tooltipRect.width) / 2 + window.scrollX;
                break;
            case "top-left":
                top = rect.top - tooltipRect.height - offset + window.scrollY;
                left = rect.left + window.scrollX;
                break;
            case "top-right":
                top = rect.top - tooltipRect.height - offset + window.scrollY;
                left = rect.right - tooltipRect.width + window.scrollX;
                break;

            // ==== BOTTOM POSITIONS ====
            case "bottom":
                top = rect.bottom + offset + window.scrollY;
                left = rect.left + (rect.width - tooltipRect.width) / 2 + window.scrollX;
                break;
            case "bottom-left":
                top = rect.bottom + offset + window.scrollY;
                left = rect.left + window.scrollX;
                break;
            case "bottom-right":
                top = rect.bottom + offset + window.scrollY;
                left = rect.right - tooltipRect.width + window.scrollX;
                break;

            // ==== SIDE POSITIONS ====
            case "left":
                top = rect.top + (rect.height - tooltipRect.height) / 2 + window.scrollY;
                left = rect.left - tooltipRect.width - offset + window.scrollX;
                break;
            case "right":
                top = rect.top + (rect.height - tooltipRect.height) / 2 + window.scrollY;
                left = rect.right + offset + window.scrollX;
                break;
        }

        this.tooltipEl.style.top = `${top}px`;
        this.tooltipEl.style.left = `${left}px`;
    }

    hideTooltip() {
        this.tooltipEl.style.opacity = "0";
        this.activeTarget = null;
    }
}
