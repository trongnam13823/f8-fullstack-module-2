export default class Toast {
    constructor({ fadeTime, visibleDuration }) {
        // Toast container element
        this.container = document.querySelector(".toast-container");
        if (!this.container) {
            this.container = document.createElement("div");
            this.container.className = "toast-container";
            document.body.appendChild(this.container);
        }

        // Animation and visibility settings
        this.fadeTime = fadeTime ?? 200; // fade animation time (ms)
        this.visibleDuration = visibleDuration ?? 5000; // default display time
    }

    // Show a toast message
    show(message, type = "info", visibleDuration) {
        const duration = visibleDuration ?? this.visibleDuration;

        const toast = document.createElement("div");
        toast.className = `toast toast-${type}`;
        toast.textContent = message;

        // Apply fadeIn animation
        toast.style.animation = `fadeIn ${this.fadeTime}ms ease forwards`;

        this.container.appendChild(toast);

        // Schedule fadeOut and removal
        setTimeout(() => {
            toast.style.animation = `fadeOut ${this.fadeTime}ms ease forwards`;
            toast.addEventListener("animationend", () => toast.remove(), { once: true });
        }, this.fadeTime + duration);
    }

    // Shortcut methods
    success(msg, duration) {
        this.show(msg, "success", duration);
    }

    error(msg, duration) {
        this.show(msg, "error", duration);
    }

    info(msg, duration) {
        this.show(msg, "info", duration);
    }

    warning(msg, duration) {
        this.show(msg, "warning", duration);
    }
}
