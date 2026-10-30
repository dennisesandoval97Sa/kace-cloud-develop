import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { fetchOneScripts } from "@kace_v2/shared/services/oneScript.service";
import useOneScriptOptions from "@kace_v2/features/boards/hooks/useOneScriptOptions.hook";

vi.mock("@kace_v2/shared/services/oneScript.service", () => ({ fetchOneScripts: vi.fn() }));

const createWrapper = () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    // eslint-disable-next-line react/display-name, react/prop-types
    return ({ children }) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const lastCallArgs = () => fetchOneScripts.mock.calls[fetchOneScripts.mock.calls.length - 1][0];

describe("useOneScriptOptions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchOneScripts.mockResolvedValue({ data: [], count: 0, total: 0 });
    });

    it("expone data como alias de options y busca por name", async () => {
        fetchOneScripts.mockResolvedValueOnce({
            data: [{ id: "os-1", name: "Formulario agente" }],
            count: 1,
            total: 1,
        });

        const { result } = renderHook(() => useOneScriptOptions(), { wrapper: createWrapper() });

        await waitFor(() => expect(result.current.data).toEqual([{ label: "Formulario agente", value: "os-1" }]));
        expect(result.current.options).toEqual(result.current.data);
        expect(lastCallArgs().order).toEqual({ direction: "asc", field: "name" });

        fetchOneScripts.mockResolvedValueOnce({
            data: [{ id: "os-2", name: "Filtro custom" }],
        });

        const searched = await result.current.onSearch("Filtro");
        expect(lastCallArgs().filter).toContainEqual({
            field: "name",
            operator: "ilike",
            type: "AND",
            value: "Filtro",
        });
        expect(searched).toEqual([{ label: "Filtro custom", value: "os-2" }]);
    });
});
