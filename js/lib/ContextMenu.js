export default class ContextMenu {
    constructor(selector, options = {}) {
        this.menu = document.querySelector(selector);
        if (!this.menu) throw new Error(`Không tìm thấy menu: ${selector}`);

        this.targetSelector = options.target || "[data-context]";

        this.onAction = options.onAction || (() => {});
        this.onBeforeShow = options.onBeforeShow || (() => {});

        // Bind để có thể remove chính xác
        this.handleContextMenu = this.handleContextMenu.bind(this);
        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleMenuClick = this.handleMenuClick.bind(this);

        this.init();
    }

    init() {
        this.menu.style.position = "absolute";
        this.menu.style.display = "none";
        this.menu.style.zIndex = 9999;

        // Dùng delegation — chỉ 1 listener cho toàn document
        document.addEventListener("contextmenu", this.handleContextMenu);
        document.addEventListener("click", this.handleDocumentClick);
        this.menu.addEventListener("click", this.handleMenuClick);
    }

    handleContextMenu(e) {
        const target = e.target.closest(this.targetSelector);

        if (!target) return;
        e.preventDefault();
        this.currentTarget = target;
        this.onBeforeShow(this.menu, target);
        this.show(e.clientX, e.clientY);
    }

    handleDocumentClick(e) {
        if (!this.menu.contains(e.target)) this.hide();
    }

    handleMenuClick(e) {
        const item = e.target.closest(".context-menu-item");
        if (item) {
            const action = item.dataset.action;
            this.onAction(action, this.currentTarget);
            this.hide();
        }
    }

    show(x, y) {
        const { innerWidth, innerHeight } = window;
        const rect = this.menu.getBoundingClientRect();
        const left = x + rect.width > innerWidth ? x - rect.width : x;
        const top = y + rect.height > innerHeight ? y - rect.height : y;
        this.menu.style.left = `${left}px`;
        this.menu.style.top = `${top}px`;
        this.menu.style.display = "block";
    }

    hide() {
        this.menu.style.display = "none";
    }

    destroy() {
        document.removeEventListener("contextmenu", this.handleContextMenu);
        document.removeEventListener("click", this.handleDocumentClick);
        this.menu.removeEventListener("click", this.handleMenuClick);
    }
}
