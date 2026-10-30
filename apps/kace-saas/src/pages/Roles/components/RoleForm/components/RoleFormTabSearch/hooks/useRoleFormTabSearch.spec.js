import { act, renderHook } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import i18next from "i18next";
import es from "@/locale/es.json";
import useRoleFormTabSearch from "./useRoleFormTabSearch";

const i18n = i18next.createInstance();

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: i18n.t.bind(i18n) }),
}));

vi.mock("formik", () => ({
    useFormikContext: () => ({
        values: {
            permisos: {
                agente: [{ module_id: "clients", name: "ClientsCreate", description: "Crear cliente", granted: false }],
                administrador: [
                    { module_id: "clients", name: "ClientsRead", description: "Ver clientes", granted: true },
                ],
                auxiliaries: [
                    {
                        module_id: "tipo_documento",
                        name: "TipoDocumentoCreate",
                        description: "Create tipo documento",
                        granted: false,
                    },
                    {
                        module_id: "clientes_aux",
                        name: "ClientesAuxRead",
                        description: "Read clientes aux",
                        granted: false,
                    },
                ],
                search: [
                    {
                        module_id: "event-logs",
                        name: "EventLogsSearchAdvanced",
                        description: "Use advanced search filters on event-logs.search",
                        granted: false,
                    },
                ],
            },
        },
        setFieldValue: vi.fn(),
    }),
}));

beforeAll(async () => {
    await i18n.init({ lng: "es", resources: { es: { translation: es } }, interpolation: { escapeValue: false } });
});

const renderOnTab = (tab) => {
    const { result } = renderHook(() => useRoleFormTabSearch());
    act(() => result.current.setActiveTab(tab));
    return result;
};

describe("useRoleFormTabSearch", () => {
    it("starts on the agent tab keeping the backend description and lists every role tab", () => {
        const { result } = renderHook(() => useRoleFormTabSearch());

        expect(result.current.activeTab).toBe("agente");
        expect(result.current.currentModules[0].permissions[0].label).toBe("Crear cliente");
        expect(result.current.availableRoles.map(({ role }) => role)).toEqual([
            "agente",
            "administrador",
            "auxiliaries",
            "search",
        ]);
    });

    it("exposes translated module names and permission labels on the search tab", () => {
        const result = renderOnTab("search");

        const [module] = result.current.currentModules;
        expect(module.name).toBe("Registros de eventos");
        expect(module.permissions[0].label).toBe("Usar filtros de búsqueda avanzada en event-logs.search");
    });

    it("keeps only the auxiliary modules whose translated permission label matches the search term", () => {
        const result = renderOnTab("auxiliaries");
        act(() => result.current.setSearchTerm("crear"));

        const modules = result.current.getFilteredModules(result.current.currentModules);
        expect(modules.map(({ id }) => id)).toEqual(["tipo_documento"]);
        expect(modules[0].permissions[0].label).toBe("Crear tipo documento");
    });
});
