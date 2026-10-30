import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import useBoardsEntities from "@kace_v2/features/boards/hooks/useBoardsEntities.hook";
import { apiService } from "@kace/utils";

vi.mock("@kace/utils", () => ({
    apiService: { get: vi.fn() },
}));

/*
 * El real desenvuelve la respuesta de axios a { data: items, count, total }; devolver el
 * objeto tal cual dejaba `response.data` como objeto y `fetchBoardsEntities` reventaba al
 * mapearlo.
 */
vi.mock("@kace_v2/shared/utils/parse-response-api.util", () => ({
    parseResponseApi: vi.fn((data) => ({
        data: data.data.items,
        count: data.data.items.length,
        total: Number(data.metadata?.count ?? data.data.items.length),
    })),
}));

/*
 * Sin mockearlo, el hook real se apoyaba en su guarda `enabled: isAuthenticated` (falsa por
 * defecto) y la rama que mezcla las vistas `boards_*` no llegaba a ejecutarse nunca.
 */
const schemaFieldsMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({ schemaFields: schemaFieldsMock() }),
}));

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: {
            queries: { retry: false },
        },
    });

    return ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

describe("Boards entities hooks", () => {
    const fakeResponse = {
        message: "Success",
        data: {
            items: ["usuarios", "clients", "cases"],
        },
        metadata: {
            count: "15",
            version: "1.4.0",
        },
    };

    beforeEach(() => {
        vi.clearAllMocks();
        schemaFieldsMock.mockReturnValue(undefined);
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("should return entities list", async () => {
        apiService.get.mockResolvedValue(fakeResponse);

        const { result } = renderHook(() => useBoardsEntities(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(apiService.get).toHaveBeenCalledWith("/boards/relations");

        expect(result.current.data).toEqual([
            { label: "usuarios", value: "usuarios" },
            { label: "clients", value: "clients" },
            { label: "cases", value: "cases" },
        ]);
    });

    it("adds the boards_* schema views after the entities, in alphabetical order", async () => {
        apiService.get.mockResolvedValue(fakeResponse);
        schemaFieldsMock.mockReturnValue({
            boards_kpi_summary: {},
            boards_cases_summary: {},
            // Las vistas que no son de tableros no deben colarse en el selector.
            cases_summary: {},
        });

        const { result } = renderHook(() => useBoardsEntities(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isSuccess).toBe(true));

        expect(result.current.data).toEqual([
            { label: "usuarios", value: "usuarios" },
            { label: "clients", value: "clients" },
            { label: "cases", value: "cases" },
            { label: "boards_cases_summary", value: "boards_cases_summary" },
            { label: "boards_kpi_summary", value: "boards_kpi_summary" },
        ]);
    });

    it("should handler errors", async () => {
        apiService.get.mockRejectedValue(new Error("Network error"));

        const { result } = renderHook(() => useBoardsEntities(), {
            wrapper: createWrapper(),
        });

        await waitFor(() => expect(result.current.isError).toBe(true));
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.error.message).toBe("Network error");
    });
});
