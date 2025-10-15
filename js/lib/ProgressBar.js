export default class ProgressBar {
    constructor(selector) {
        this.bar = document.querySelector(selector);
        this.fill = this.bar.querySelector(".progress-fill");
        this.handle = this.bar.querySelector(".progress-handle");
        this.value = 0;
        this.isDown = false;

        // Callback API
        this._onStart = null;
        this._onChange = null;
        this._onEnd = null;

        const update = (clientX) => {
            const rect = this.bar.getBoundingClientRect();
            let percent = ((clientX - rect.left) / rect.width) * 100;
            this.value = Math.max(0, Math.min(100, percent));
            this.fill.style.width = this.value + "%";
            this.handle.style.left = this.value + "%";
            if (this._onChange) this._onChange(this.value);
        };

        const start = (clientX) => {
            this.isDown = true;
            if (this._onStart) this._onStart(this.value);
            update(clientX);
        };

        const end = () => {
            if (this.isDown && this._onEnd) this._onEnd(this.value);
            this.isDown = false;
        };

        // Chuột
        this.bar.addEventListener("mousedown", (e) => start(e.clientX));
        window.addEventListener("mousemove", (e) => this.isDown && update(e.clientX));
        window.addEventListener("mouseup", end);

        // Cảm ứng
        this.bar.addEventListener("touchstart", (e) => start(e.touches[0].clientX));
        window.addEventListener("touchmove", (e) => this.isDown && update(e.touches[0].clientX));
        window.addEventListener("touchend", end);

        // Click nhảy
        this.bar.addEventListener("click", (e) => update(e.clientX));
    }

    // === API ===
    onStart(fn) {
        this._onStart = fn;
    }
    onChange(fn) {
        this._onChange = fn;
    }
    onEnd(fn) {
        this._onEnd = fn;
    }

    setValue(percent) {
        this.value = Math.max(0, Math.min(100, percent));
        this.fill.style.width = this.value + "%";
        this.handle.style.left = this.value + "%";
        if (this._onChange) this._onChange(this.value);
    }

    getValue() {
        return this.value;
    }
}
