import i18n from "i18next";

export default class BootstrapValidator {
    constructor(classInput) {
        this.classesToValidate = [];

        if (typeof classInput === "string") {
            this.classesToValidate = classInput.split(" ").filter((c) => c.trim() !== "");
        } else if (Array.isArray(classInput)) {
            this.classesToValidate = classInput;
        }

        this.staticClasses = new Set([
            "active",
            " show",
            "fade",
            "disabled",
            "d-none",
            "d-inline",
            "d-inline-block",
            "d-block",
            "d-table",
            "d-table-row",
            "d-table-cell",
            "d-flex",
            "d-inline-flex",
            "d-print-none",
            "d-print-inline",
            "d-print-block",
            "flex-row",
            "flex-column",
            "flex-row-reverse",
            "flex-column-reverse",
            "flex-wrap",
            "flex-nowrap",
            "flex-wrap-reverse",
            "justify-content-start",
            "justify-content-end",
            "justify-content-center",
            "justify-content-between",
            "justify-content-around",
            "align-items-start",
            "align-items-end",
            "align-items-center",
            "align-items-baseline",
            "align-items-stretch",
            "align-content-start",
            "align-content-end",
            "align-content-center",
            "align-content-between",
            "align-content-around",
            "align-content-stretch",
            "align-self-start",
            "align-self-end",
            "align-self-center",
            "align-self-baseline",
            "align-self-stretch",
            "flex-fill",
            "flex-grow-0",
            "flex-grow-1",
            "flex-shrink-0",
            "flex-shrink-1",
            "float-left",
            "float-right",
            "float-none",
            "clearfix",
            "position-static",
            "position-relative",
            "position-absolute",
            "position-fixed",
            "position-sticky",
            "fixed-top",
            "fixed-bottom",
            "sticky-top",
            "sr-only",
            "sr-only-focusable",
            "shadow-sm",
            "shadow",
            "shadow-lg",
            "shadow-none",
            "w-25",
            "w-50",
            "w-75",
            "w-100",
            "w-auto",
            "h-25",
            "h-50",
            "h-75",
            "h-100",
            "h-auto",
            "mw-100",
            "mh-100",
            "rounded",
            "rounded-top",
            "rounded-right",
            "rounded-bottom",
            "rounded-left",
            "rounded-circle",
            "rounded-pill",
            "rounded-0",
            "text-monospace",
            "text-justify",
            "text-wrap",
            "text-nowrap",
            "text-truncate",
            "text-left",
            "text-right",
            "text-center",
            "text-lowercase",
            "text-uppercase",
            "text-capitalize",
            "font-weight-bold",
            "font-weight-bolder",
            "font-weight-normal",
            "font-weight-light",
            "font-weight-lighter",
            "font-style-italic",
            "font-style-normal",
            "text-white",
            "text-primary",
            "text-secondary",
            "text-success",
            "text-danger",
            "text-warning",
            "text-info",
            "text-light",
            "text-dark",
            "text-body",
            "text-muted",
            "text-black-50",
            "text-white-50",
            "text-hide",
            "text-decoration-none",
            "visible",
            "invisible",
            "container",
            "container-fluid",
            "container-sm",
            "container-md",
            "container-lg",
            "container-xl",
            "row",
            "col",
            "form-row",
            "alert",
            "alert-heading",
            "alert-link",
            "alert-dismissible",
            "badge",
            "badge-pill",
            "breadcrumb",
            "breadcrumb-item",
            "btn",
            "btn-group",
            "btn-group-vertical",
            "btn-toolbar",
            "btn-link",
            "btn-block",
            "card",
            "card-header",
            "card-body",
            "card-footer",
            "card-title",
            "card-subtitle",
            "card-text",
            "card-link",
            "card-img",
            "card-img-top",
            "card-img-bottom",
            "card-img-overlay",
            "card-deck",
            "card-group",
            "card-columns",
            "carousel",
            "carousel-inner",
            "carousel-item",
            "carousel-control-prev",
            "carousel-control-next",
            "carousel-control-prev-icon",
            "carousel-control-next-icon",
            "carousel-indicators",
            "carousel-caption",
            "collapse",
            "collapsing",
            "dropdown",
            "dropdown-menu",
            "dropdown-item",
            "dropdown-divider",
            "dropdown-toggle",
            "dropdown-header",
            "form-group",
            "form-control",
            "form-control-file",
            "form-control-range",
            "form-check",
            "form-check-input",
            "form-check-label",
            "form-text",
            "form-inline",
            "input-group",
            "input-group-prepend",
            "input-group-append",
            "input-group-text",
            "jumbotron",
            "jumbotron-fluid",
            "list-group",
            "list-group-item",
            "list-group-item-action",
            "list-group-horizontal",
            "media",
            "media-body",
            "modal",
            "modal-dialog",
            "modal-content",
            "modal-header",
            "modal-title",
            "modal-body",
            "modal-footer",
            "modal-dialog-centered",
            "modal-dialog-scrollable",
            "nav",
            "nav-link",
            "nav-item",
            "nav-tabs",
            "nav-pills",
            "nav-fill",
            "nav-justified",
            "navbar",
            "navbar-brand",
            "navbar-nav",
            "navbar-text",
            "navbar-collapse",
            "navbar-toggler",
            "navbar-toggler-icon",
            "navbar-expand",
            "pagination",
            "page-item",
            "page-link",
            "popover",
            "popover-header",
            "popover-body",
            "progress",
            "progress-bar",
            "progress-bar-striped",
            "progress-bar-animated",
            "spinner-border",
            "spinner-grow",
            "toast",
            "toast-header",
            "toast-body",
            "tooltip",
            "close",
        ]);

        this.patternedClasses = [
            /^col(-\d{1,2})?$/,
            /^col-(sm|md|lg|xl)(-\d{1,2}|-auto)?$/,
            /^offset-\d{1,2}$/,
            /^offset-(sm|md|lg|xl)-\d{1,2}$/,
            /^order-(\d{1,2}|first|last)$/,
            /^order-(sm|md|lg|xl)-(\d{1,2}|first|last)$/,
            /^d-(sm|md|lg|xl)-(none|inline|inline-block|block|table|table-row|table-cell|flex|inline-flex)$/,
            /^flex-(sm|md|lg|xl)-(row|column|row-reverse|column-reverse)$/,
            /^flex-(sm|md|lg|xl)-(wrap|nowrap|wrap-reverse)$/,
            /^justify-content-(sm|md|lg|xl)-(start|end|center|between|around)$/,
            /^align-items-(sm|md|lg|xl)-(start|end|center|baseline|stretch)$/,
            /^align-content-(sm|md|lg|xl)-(start|end|center|between|around|stretch)$/,
            /^align-self-(sm|md|lg|xl)-(start|end|center|baseline|stretch)$/,
            /^[mp][tblrxy]?-\d{1,2}$/,
            /^[mp][tblrxy]?-auto$/,
            /^[mp][tblrxy]?-(sm|md|lg|xl)-\d{1,2}$/,
            /^[mp][tblrxy]?-(sm|md|lg|xl)-auto$/,
            /^(bg|text|border|alert|badge|btn|btn-outline|list-group-item|table)-(primary|secondary|success|danger|warning|info|light|dark|white|transparent|muted|body)$/,
            /^border(-\d)?$/,
            /^border-(top|bottom|left|right)(-\d)?$/,
            /^btn-(lg|sm)$/,
            /^navbar-expand(-(sm|md|lg|xl))?$/,
            /^modal-(sm|lg|xl)$/,
            /^(spinner-border|spinner-grow)-(sm)$/,
        ];
    }

    _isValid(className) {
        if (this.staticClasses.has(className)) {
            return true;
        }
        for (const pattern of this.patternedClasses) {
            if (pattern.test(className)) {
                return true;
            }
        }
        return false;
    }

    areAllValid() {
        if (this.classesToValidate.length === 0) return true;
        return this.classesToValidate.every((className) => this._isValid(className));
    }

    getInvalidClasses() {
        if (this.classesToValidate.length === 0) return [];
        return this.classesToValidate.filter((className) => !this._isValid(className));
    }

    getAllClasses({ grouped = false } = {}) {
        if (!this._comprehensiveList) {
            this._comprehensiveList = this._generateComprehensiveList();
        }

        if (grouped) {
            return this._comprehensiveList;
        } else {
            return this._comprehensiveList.flatMap((group) => group.classes);
        }
    }

    _generateComprehensiveList() {
        const t = i18n.t.bind(i18n);
        const groups = new Map();
        const addToGroup = (name, items) => {
            if (!groups.has(name)) groups.set(name, new Set());
            const groupSet = groups.get(name);
            for (const item of items) {
                groupSet.add(item);
            }
        };

        const breakpoints = ["", "-sm", "-md", "-lg", "-xl"];
        const colors = [
            "primary",
            "secondary",
            "success",
            "danger",
            "warning",
            "info",
            "light",
            "dark",
            "white",
            "body",
            "muted",
            "transparent",
        ];
        const spacingSizes = [0, 1, 2, 3, 4, 5];

        addToGroup(t("auxSchema.form.group.layoutContainer"), [
            "container",
            "container-fluid",
            "container-sm",
            "container-md",
            "container-lg",
            "container-xl",
        ]);
        addToGroup(t("auxSchema.form.group.layoutGrid"), ["row", "col", "form-row"]);
        addToGroup(t("auxSchema.form.group.sizing"), [
            "w-25",
            "w-50",
            "w-75",
            "w-100",
            "w-auto",
            "h-25",
            "h-50",
            "h-75",
            "h-100",
            "h-auto",
            "mw-100",
            "mh-100",
        ]);
        addToGroup(t("auxSchema.form.group.display"), [
            "d-none",
            "d-inline",
            "d-inline-block",
            "d-block",
            "d-table",
            "d-table-row",
            "d-table-cell",
            "d-flex",
            "d-inline-flex",
        ]);
        addToGroup(t("auxSchema.form.group.flexDirection"), [
            "flex-row",
            "flex-column",
            "flex-row-reverse",
            "flex-column-reverse",
        ]);
        addToGroup(t("auxSchema.form.group.flexWrap"), ["flex-wrap", "flex-nowrap", "flex-wrap-reverse"]);
        addToGroup(t("auxSchema.form.group.flexGrowShrink"), [
            "flex-fill",
            "flex-grow-0",
            "flex-grow-1",
            "flex-shrink-0",
            "flex-shrink-1",
        ]);
        addToGroup(t("auxSchema.form.group.position"), [
            "position-static",
            "position-relative",
            "position-absolute",
            "position-fixed",
            "position-sticky",
            "fixed-top",
            "fixed-bottom",
            "sticky-top",
            "clearfix",
        ]);
        addToGroup(t("auxSchema.form.group.borders"), [
            "rounded",
            "rounded-top",
            "rounded-right",
            "rounded-bottom",
            "rounded-left",
            "rounded-circle",
            "rounded-pill",
            "rounded-0",
        ]);
        addToGroup(t("auxSchema.form.group.shadows"), ["shadow-sm", "shadow", "shadow-lg", "shadow-none"]);
        addToGroup(t("auxSchema.form.group.textAlignment"), [
            "text-justify",
            "text-wrap",
            "text-nowrap",
            "text-truncate",
            "text-left",
            "text-right",
            "text-center",
        ]);
        addToGroup(t("auxSchema.form.group.textTransform"), [
            "text-lowercase",
            "text-uppercase",
            "text-capitalize",
            "font-weight-bold",
            "font-weight-bolder",
            "font-weight-normal",
            "font-weight-light",
            "font-weight-lighter",
            "font-style-italic",
            "font-style-normal",
            "text-monospace",
            "text-decoration-none",
        ]);
        addToGroup(t("auxSchema.form.group.textColor"), [
            ...colors.map((c) => `text-${c}`),
            "text-black-50",
            "text-white-50",
        ]);
        addToGroup(t("auxSchema.form.group.visibility"), [
            "visible",
            "invisible",
            "sr-only",
            "sr-only-focusable",
            "text-hide",
            "close",
        ]);
        addToGroup(t("auxSchema.form.group.alert"), ["alert", "alert-heading", "alert-link", "alert-dismissible"]);
        addToGroup(t("auxSchema.form.group.badge"), ["badge", "badge-pill"]);
        addToGroup(t("auxSchema.form.group.breadcrumb"), ["breadcrumb", "breadcrumb-item"]);
        addToGroup(t("auxSchema.form.group.button"), ["btn", "btn-link", "btn-block"]);
        addToGroup(t("auxSchema.form.group.buttonGroup"), ["btn-group", "btn-group-vertical", "btn-toolbar"]);
        addToGroup(t("auxSchema.form.group.card"), [
            "card",
            "card-header",
            "card-body",
            "card-footer",
            "card-title",
            "card-subtitle",
            "card-text",
            "card-link",
            "card-img",
            "card-img-top",
            "card-img-bottom",
            "card-img-overlay",
            "card-deck",
            "card-group",
            "card-columns",
        ]);
        addToGroup(t("auxSchema.form.group.carousel"), [
            "carousel",
            "carousel-inner",
            "carousel-item",
            "carousel-control-prev",
            "carousel-control-next",
            "carousel-control-prev-icon",
            "carousel-control-next-icon",
            "carousel-indicators",
            "carousel-caption",
        ]);
        addToGroup(t("auxSchema.form.group.collapse"), ["collapse", "collapsing", "show"]);
        addToGroup(t("auxSchema.form.group.dropdown"), [
            "dropdown",
            "dropdown-menu",
            "dropdown-item",
            "dropdown-divider",
            "dropdown-toggle",
            "dropdown-header",
        ]);
        addToGroup(t("auxSchema.form.group.forms"), [
            "form-group",
            "form-control",
            "form-control-file",
            "form-control-range",
            "form-check",
            "form-check-input",
            "form-check-label",
            "form-text",
            "form-inline",
        ]);
        addToGroup(t("auxSchema.form.group.inputGroup"), [
            "input-group",
            "input-group-prepend",
            "input-group-append",
            "input-group-text",
        ]);
        addToGroup(t("auxSchema.form.group.jumbotron"), ["jumbotron", "jumbotron-fluid"]);
        addToGroup(t("auxSchema.form.group.listGroup"), [
            "list-group",
            "list-group-item",
            "list-group-item-action",
            "list-group-horizontal",
        ]);
        addToGroup(t("auxSchema.form.group.media"), ["media", "media-body"]);
        addToGroup(t("auxSchema.form.group.modal"), [
            "modal",
            "modal-dialog",
            "modal-content",
            "modal-header",
            "modal-title",
            "modal-body",
            "modal-footer",
            "modal-dialog-centered",
            "modal-dialog-scrollable",
            "fade",
        ]);
        addToGroup(t("auxSchema.form.group.navbar"), [
            "nav",
            "nav-link",
            "nav-item",
            "nav-tabs",
            "nav-pills",
            "nav-fill",
            "nav-justified",
            "navbar",
            "navbar-brand",
            "navbar-nav",
            "navbar-text",
            "navbar-collapse",
            "navbar-toggler",
            "navbar-toggler-icon",
            "navbar-expand",
            ...["-sm", "-md", "-lg", "-xl"].map((b) => `navbar-expand${b}`),
        ]);
        addToGroup(t("auxSchema.form.group.pagination"), [
            "pagination",
            "page-item",
            "page-link",
            "active",
            "disabled",
        ]);
        addToGroup(t("auxSchema.form.group.popoverTooltip"), ["popover", "popover-header", "popover-body", "tooltip"]);
        addToGroup(t("auxSchema.form.group.progress"), [
            "progress",
            "progress-bar",
            "progress-bar-striped",
            "progress-bar-animated",
        ]);
        addToGroup(t("auxSchema.form.group.spinner"), [
            "spinner-border",
            "spinner-grow",
            "spinner-border-sm",
            "spinner-grow-sm",
        ]);
        addToGroup(t("auxSchema.form.group.toast"), ["toast", "toast-header", "toast-body"]);

        const gridSizes = Array.from({ length: 12 }, (_, i) => i + 1);
        addToGroup(t("auxSchema.form.group.layoutGridColumns"), ["col", ...gridSizes.map((s) => `col-${s}`)]);

        breakpoints
            .slice(1)
            .forEach((bp) =>
                addToGroup(t("auxSchema.form.group.layoutGridColumns"), [
                    `col${bp}`,
                    `col${bp}-auto`,
                    ...gridSizes.map((s) => `col${bp}-${s}`),
                ]),
            );

        addToGroup(
            t("auxSchema.form.group.layoutGridOffset"),
            gridSizes.map((s) => `offset-${s}`),
        );

        breakpoints.slice(1).forEach((bp) =>
            addToGroup(
                t("auxSchema.form.group.layoutGridOffset"),
                gridSizes.map((s) => `offset${bp}-${s}`),
            ),
        );

        const orderValues = [...Array.from({ length: 12 }, (_, i) => i + 1), "first", "last"];
        breakpoints.forEach((bp) =>
            addToGroup(
                t("auxSchema.form.group.layoutGridOrder"),
                orderValues.map((o) => `order${bp}-${o}`),
            ),
        );

        const displayValues = [
            "none",
            "inline",
            "inline-block",
            "block",
            "table",
            "table-row",
            "table-cell",
            "flex",
            "inline-flex",
        ];
        breakpoints.slice(1).forEach((bp) =>
            addToGroup(
                t("auxSchema.form.group.display"),
                displayValues.map((d) => `d${bp}-${d}`),
            ),
        );

        const flexDirections = ["row", "column", "row-reverse", "column-reverse"];
        breakpoints.forEach((bp) =>
            addToGroup(
                t("auxSchema.form.group.flexDirection"),
                flexDirections.map((d) => `flex${bp}-${d}`),
            ),
        );

        ["justify-content", "align-items", "align-content", "align-self"].forEach((prop) => {
            const values =
                prop === "align-self" || prop === "align-items"
                    ? ["start", "end", "center", "baseline", "stretch"]
                    : ["start", "end", "center", "between", "around"];
            const groupName = `Flex: ${prop.charAt(0).toUpperCase() + prop.slice(1).replace("-", " ")}`;
            breakpoints.forEach((bp) =>
                addToGroup(
                    groupName,
                    values.map((v) => `${prop}${bp}-${v}`),
                ),
            );
        });

        ["m", "p"].forEach((prop) => {
            const sides = ["", "t", "b", "l", "r", "x", "y"];
            const groupName = prop === "m" ? "Spacing: Margin" : "Spacing: Padding";
            sides.forEach((side) => {
                breakpoints.forEach((bp) => {
                    addToGroup(
                        groupName,
                        spacingSizes.map((size) => `${prop}${side}${bp}-${size}`),
                    );
                    if (side === "" || side === "x") addToGroup(groupName, [`${prop}${side}${bp}-auto`]);
                });
            });
        });

        ["bg", "border", "alert", "badge", "list-group-item", "table"].forEach((prefix) => {
            addToGroup(
                t("auxSchema.form.group.colors"),
                colors.map((c) => `${prefix}-${c}`),
            );
        });

        addToGroup(
            t("auxSchema.form.group.colors"),
            colors.map((c) => `btn-${c}`),
        );
        addToGroup(
            t("auxSchema.form.group.colors"),
            colors.filter((c) => c !== "transparent").map((c) => `btn-outline-${c}`),
        );

        addToGroup(t("auxSchema.form.group.borders"), [
            "border",
            "border-0",
            ...["top", "bottom", "left", "right"].map((s) => `border-${s}`),
            ...["top", "bottom", "left", "right"].map((s) => `border-${s}-0`),
        ]);

        return Array.from(groups.entries())
            .map(([name, classSet]) => ({ name, classes: Array.from(classSet).sort() }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }
}
