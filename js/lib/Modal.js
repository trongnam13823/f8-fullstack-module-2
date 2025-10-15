export default class Modal {
    #modal;
    #closeBtn;
    #onOpen;
    #onClose;
    #closeOnOverlay;

    constructor(modalEl, options = {}) {
        this.#modal = modalEl;
        this.#closeBtn = modalEl.querySelector(options.closeBtn) || null;
        this.#onOpen = options.onOpen || (() => {});
        this.#onClose = options.onClose || (() => {});
        this.#closeOnOverlay = options.closeOnOverlay ?? true;

        this.#init();
    }

    // Initialize modal event listeners
    #init() {
        if (this.#closeBtn) {
            this.#closeBtn.addEventListener("click", () => this.close());
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && this.isOpen()) this.close();
        });

        this.#modal.addEventListener("click", (e) => {
            if (this.#closeOnOverlay && e.target === this.#modal) {
                this.close();
            }
        });
    }

    // Open modal
    open() {
        this.#modal.classList.add("show");
        document.body.style.overflow = "hidden";
        this.#onOpen();
    }

    // Close modal
    close() {
        this.#modal.classList.remove("show");
        document.body.style.overflow = "auto";
        this.#onClose();
    }

    // Toggle modal state
    toggle() {
        this.isOpen() ? this.close() : this.open();
    }

    // Check if modal is open
    isOpen() {
        return this.#modal.classList.contains("show");
    }
}
