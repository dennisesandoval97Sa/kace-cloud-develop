import { beforeAll, describe, expect, it } from "vitest";
import i18next from "i18next";
import en from "@/locale/en.json";
import es from "@/locale/es.json";
import { generateAuxiliariesPermissions, getPermissionLabel } from "./processRoleData";

let t;
let tEn;

const createT = async (lng, translation) => {
    const i18n = i18next.createInstance();
    await i18n.init({ lng, resources: { [lng]: { translation } }, interpolation: { escapeValue: false } });
    return i18n.t.bind(i18n);
};

beforeAll(async () => {
    t = await createT("es", es);
    tEn = await createT("en", en);
});

describe("getPermissionLabel", () => {
    it("translates an advanced search permission keeping its endpoint", () => {
        const permission = {
            name: "CasesSearchAdvanced",
            description: "Use advanced search filters on cases.search",
            module_id: "cases",
        };

        expect(getPermissionLabel(permission, "search", t)).toBe("Usar filtros de búsqueda avanzada en cases.search");
    });

    it("translates every generated auxiliary permission action", () => {
        const permissions = generateAuxiliariesPermissions([{ name: "tipo_documento" }]);

        expect(permissions.map((permission) => getPermissionLabel(permission, "auxiliaries", t))).toEqual([
            "Crear tipo documento",
            "Actualizar tipo documento",
            "Eliminar tipo documento",
            "Ver tipo documento",
        ]);
    });

    it("translates search and auxiliary permissions in English too", () => {
        const [auxiliaryCreate] = generateAuxiliariesPermissions([{ name: "tipo_documento" }]);
        const searchPermission = {
            name: "CasesSearchAdvanced",
            description: "Use advanced search filters on cases.search",
            module_id: "cases",
        };

        expect(getPermissionLabel(auxiliaryCreate, "auxiliaries", tEn)).toBe("Create tipo documento");
        expect(getPermissionLabel(searchPermission, "search", tEn)).toBe("Use advanced search filters on cases.search");
    });

    it("keeps the backend description when a search permission lacks the advanced search prefix", () => {
        const permission = { name: "LegacySearch", description: "Búsqueda avanzada", module_id: "cases" };

        expect(getPermissionLabel(permission, "search", t)).toBe("Búsqueda avanzada");
    });

    it("keeps the backend description when an auxiliary name is not PascalCase(module_id) plus an action", () => {
        const permission = {
            name: "TipoDocumentoExport",
            description: "Export tipo documento",
            module_id: "tipo_documento",
        };

        expect(getPermissionLabel(permission, "auxiliaries", t)).toBe("Export tipo documento");
    });

    it("keeps the backend description for permissions outside auxiliaries and search", () => {
        const permission = { name: "ClientsCreate", description: "Crear cliente", module_id: "clients" };

        expect(getPermissionLabel(permission, "agente", t)).toBe("Crear cliente");
    });
});

const NEW_PERMISSION_MODULES = [
    "channel-hub",
    "boards",
    "broker_adapters",
    "broker_mappers",
    "custom-lists",
    "emails",
    "event-logs",
    "interactions",
    "schemas.rules",
    "transition-rules",
    "workspaces",
    "assignment-runs",
    "classifications-flows",
    "subcase-relationships",
];

describe.each([
    ["es", es],
    ["en", en],
])("role form translations (%s)", (_lng, dictionary) => {
    it.each(NEW_PERMISSION_MODULES)("has a non-empty name for the permission module %s", (moduleId) => {
        const value = dictionary.modulesNames[moduleId];

        expect(value, `missing modulesNames.${moduleId}`).toBeTypeOf("string");
        expect(value.trim()).not.toBe("");
    });

    it("has a non-empty text for every permission label", () => {
        const labels = dictionary.rol.form.permissionLabels;

        expect(Object.keys(labels).sort()).toEqual(
            ["auxiliaryCreate", "auxiliaryDelete", "auxiliaryRead", "auxiliaryUpdate", "searchAdvanced"].sort(),
        );
        Object.values(labels).forEach((value) => expect.soft(value.trim()).not.toBe(""));
    });
});

describe("role form translations parity", () => {
    it("has the same modulesNames keys in Spanish and English", () => {
        expect(Object.keys(en.modulesNames).sort()).toEqual(Object.keys(es.modulesNames).sort());
    });

    it("resolves the permissions section subtitle in both languages", () => {
        expect(t("rol.form.subtitlePermissions")).toBe(
            "Organiza permisos por categorías con búsqueda global y filtros avanzados",
        );
        expect(tEn("rol.form.subtitlePermissions")).toBe(
            "Organize permissions by category with global search and advanced filters",
        );
    });
});
