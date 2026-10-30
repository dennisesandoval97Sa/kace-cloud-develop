import { describe, expect, it } from "vitest";
import i18n from "./i18n";

/*
 * Contrato de la copia de borrado: `app.forms.success_delete_module` interpola el
 * nombre del módulo. Este spec cubre de una sola vez los hooks que la consumen, que
 * en su mayoría no tienen test propio: si alguien rompe la interpolación (renombra
 * la variable, quita la clave de un idioma o pierde un título de módulo), falla aquí.
 */
const MODULE_TITLE_KEYS = [
    "app.title.automationSettings",
    "app.title.banners",
    "app.title.classifications",
    "app.title.flows",
    "app.title.generalSetup",
    "app.title.generateCsv",
    "app.title.group_singular",
    "app.title.mailAccounts",
    "app.title.relationshipClassification",
    "app.title.restEndPoint",
    "app.title.restFlow",
    "app.title.restFunction",
    "app.title.schedules",
];

const LANGUAGES = ["es", "en"];

describe("delete confirmation messages", () => {
    it.each(LANGUAGES)("resolves the success_delete_module template in %s", (language) => {
        const t = i18n.getFixedT(language);

        expect(t("app.forms.success_delete_module")).not.toBe("app.forms.success_delete_module");
        expect(t("app.forms.success_delete_module")).toContain("{{module}}");
    });

    it.each(LANGUAGES.flatMap((language) => MODULE_TITLE_KEYS.map((titleKey) => [language, titleKey])))(
        "interpolates %s copy for %s",
        (language, titleKey) => {
            const t = i18n.getFixedT(language);
            const module = t(titleKey);
            const message = t("app.forms.success_delete_module", { module });

            expect(module).not.toBe(titleKey);
            expect(message).toContain(module);
            expect(message).not.toContain("{{");
        },
    );

    it("keeps the delete copy keys in sync across languages", () => {
        const keys = [
            "app.forms.success_delete",
            "app.forms.success_delete_module",
            "app.forms.error_delete",
            "app.alerts.fieldDelete",
            "app.error.restFlow",
        ];

        keys.forEach((key) => {
            LANGUAGES.forEach((language) => {
                expect(i18n.getFixedT(language)(key)).not.toBe(key);
            });
        });
    });
});
