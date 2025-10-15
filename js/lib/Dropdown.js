export default class Dropdown {
    constructor(toggleElement, dropdownElement) {
        this.toggleElement = toggleElement;
        this.dropdownElement = dropdownElement;

        this.#bindEvents();
    }

    /** Bind click and key events */
    #bindEvents() {
        this.toggleElement.addEventListener("click", (e) => {
            e.stopPropagation();
            this.toggle();
        });

        document.addEventListener("click", (e) => {
            if (!this.toggleElement.contains(e.target) && !this.dropdownElement.contains(e.target)) {
                this.close();
            }
        });

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") this.close();
        });
    }

    /** Toggle dropdown visibility */
    toggle() {
        this.dropdownElement.classList.toggle("show");
    }

    /** Open dropdown */
    open() {
        this.dropdownElement.classList.add("show");
    }

    /** Close dropdown */
    close() {
        this.dropdownElement.classList.remove("show");
    }
}
