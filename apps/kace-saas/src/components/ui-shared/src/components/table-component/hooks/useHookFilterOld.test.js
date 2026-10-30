import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
    post: vi.fn(),
    setQueryData: vi.fn(),
    fetchQuery: vi.fn(async () => ({ data: [] })),
    toast: { info: vi.fn(), promise: vi.fn(), dismiss: vi.fn() },
    user: null,
    schemaFields: [],
    genericSearchService: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
    useQueryClient: () => ({
        fetchQuery: mocks.fetchQuery,
        setQueryData: mocks.setQueryData,
    }),
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@kace/utils", async (importOriginal) => ({
    ...(await importOriginal()),
    apiService: { post: mocks.post },
}));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));
vi.mock("../../../../../../hooks/useUserInformation", () => ({ default: () => ({ user: mocks.user }) }));
vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({ getSchemaField: () => mocks.schemaFields }),
}));
vi.mock("../../../../../../services/genericSearchService", () => ({
    genericSearchService: mocks.genericSearchService,
}));

const { default: useHookFilterOld } = await import("./useHookFilterOld");

describe("useHookFilterOld handleNewFilter", () => {
    const nameTable = { table: "cases", schemaFields: "cases" };

    beforeEach(() => {
        vi.clearAllMocks();
        mocks.post.mockResolvedValue({ status: 200 });
        mocks.user = {
            id: "user-1",
            account_type: "admin",
            grupo_activo: "g1",
            // No `filters` key at all, matching a user who never saved a legacy filter before.
        };
        mocks.schemaFields = [];
    });

    it("does not throw and saves under application.admin when the user has no filters yet", async () => {
        const { result } = renderHook(() =>
            useHookFilterOld({
                nameHelper: [],
                nameTable,
                keyQueryData: "cases",
                setValue: vi.fn(),
                reset: vi.fn(),
            }),
        );

        await act(async () => {
            await expect(result.current.handleNewFilter("MyFilter", { reference: "1" }, true)).resolves.not.toThrow();
        });

        expect(mocks.post).toHaveBeenCalledWith(
            "/users/user-1",
            expect.objectContaining({
                filters: expect.objectContaining({
                    application: expect.objectContaining({
                        admin: expect.objectContaining({
                            cases: expect.objectContaining({
                                MyFilter: { reference: "1" },
                            }),
                        }),
                    }),
                }),
            }),
        );
    });

    it("searches UUID id columns with eq instead of ilike", async () => {
        mocks.fetchQuery.mockImplementation(async ({ queryFn }) => queryFn());
        mocks.genericSearchService.mockResolvedValue({ data: [] });

        const { result } = renderHook(() =>
            useHookFilterOld({
                nameHelper: [],
                nameTable,
                keyQueryData: "cases",
                setValue: vi.fn(),
                reset: vi.fn(),
            }),
        );

        await act(async () => {
            await result.current.onSubmit({ grupo_id: "group-uuid", nombre: "BO" });
        });

        expect(mocks.genericSearchService).toHaveBeenCalledWith(
            "cases/search",
            expect.arrayContaining([
                expect.objectContaining({ field: "cases.grupo_id", operator: "eq", value: "group-uuid" }),
                expect.objectContaining({ field: "cases.nombre", operator: "ilike", value: "BO" }),
            ]),
            expect.objectContaining({ limit: 100, offset: 0 }),
            "cases",
        );
    });
});
