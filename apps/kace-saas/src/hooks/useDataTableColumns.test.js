import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));
vi.mock("@/services/createSchemaFilter", async (importOriginal) => {
    const actual = await importOriginal();
    return { ...actual, resolveGridColumnHeader: vi.fn(actual.resolveGridColumnHeader) };
});

const { useDataTableColumns } = await import("./useDataTableColumns");
const { resolveGridColumnHeader } = await import("@/services/createSchemaFilter");

describe("useDataTableColumns Cases header namespace", () => {
    const rawSchema = [{ column_name: "created_at", label: "Created at", data_type: "date" }];

    it("passes the columnsCases namespace when dataTableConfig.entity is the Cases entity (main /cases grid)", () => {
        resolveGridColumnHeader.mockClear();
        const dataTableConfig = {
            entity: URL_AND_KEYS.cases.entity,
            view: "cases",
            genericColumns: ["created_at"],
        };

        renderHook(() => useDataTableColumns({ rawSchema, dataTableConfig }));

        expect(resolveGridColumnHeader).toHaveBeenCalledWith(
            expect.objectContaining({ column_name: "created_at" }),
            expect.any(Function),
            "columnsCases",
        );
    });

    it("passes the columnsCases namespace for the AdminCaseSubCases table (Cases entity, different key)", () => {
        resolveGridColumnHeader.mockClear();
        const dataTableConfig = {
            entity: URL_AND_KEYS.cases.entity,
            key: "subcases-case-123",
            view: null,
            genericColumns: ["created_at"],
        };

        renderHook(() => useDataTableColumns({ rawSchema, dataTableConfig }));

        expect(resolveGridColumnHeader).toHaveBeenCalledWith(
            expect.objectContaining({ column_name: "created_at" }),
            expect.any(Function),
            "columnsCases",
        );
    });

    it("passes the columnsCases namespace for a saved custom Cases view (Cases key, custom entity) — regression for the M3 gap", () => {
        resolveGridColumnHeader.mockClear();
        const dataTableConfig = {
            entity: "view_case_admin",
            key: URL_AND_KEYS.cases.key,
            view: "view_case_admin",
            genericColumns: ["created_at"],
        };

        renderHook(() => useDataTableColumns({ rawSchema, dataTableConfig }));

        expect(resolveGridColumnHeader).toHaveBeenCalledWith(
            expect.objectContaining({ column_name: "created_at" }),
            expect.any(Function),
            "columnsCases",
        );
    });

    it("does not pass a namespace for a non-Cases entity (e.g. roles)", () => {
        resolveGridColumnHeader.mockClear();
        const dataTableConfig = {
            entity: "roles",
            view: "roles",
            genericColumns: ["created_at"],
        };

        renderHook(() => useDataTableColumns({ rawSchema, dataTableConfig }));

        expect(resolveGridColumnHeader).toHaveBeenCalledWith(
            expect.objectContaining({ column_name: "created_at" }),
            expect.any(Function),
            undefined,
        );
    });
});
