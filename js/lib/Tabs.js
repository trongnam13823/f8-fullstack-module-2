export default class Tabs {
    idActive;
    constructor(rootSelector, activeClass = "active") {
        this.root = document.querySelector(rootSelector);
        this.activeClass = activeClass;
        this.buttons = this.root.querySelectorAll("[data-tab]");
        this.panels = this.root.querySelectorAll("[data-panel]");
        this.onclick = null; // user can assign a callback

        this._init();
    }

    _init() {
        this.buttons.forEach((btn) => {
            btn.addEventListener("click", () => this.activate(btn.dataset.tab));
        });

        // Mặc định chọn tab đầu tiên
        if (this.buttons.length) {
            this.activate(this.buttons[0].dataset.tab);
        }
    }

    activate(id) {
        this.idActive = id;

        this.buttons.forEach((btn) => {
            btn.classList.toggle(this.activeClass, btn.dataset.tab === id);
        });

        this.panels.forEach((p) => {
            p.classList.toggle(this.activeClass, p.dataset.panel === id);
        });

        // Gọi callback onclick nếu có
        if (typeof this.onclick === "function") {
            this.onclick(id);
        }
    }
}
