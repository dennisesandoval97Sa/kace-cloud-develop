import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiService } from "@kace/utils";
import { fetchUsers } from "@kace_v2/shared/services/users.service";
import { useUsersFilterOptions } from "./useUsersFilterOptions";
import { LIMIT_PAG } from "@/services/genericSearch";

vi.mock("@kace/utils", () => ({
    apiService: { post: vi.fn() },
}));

vi.mock("@kace_v2/shared/services/users.service", () => ({
    fetchUsers: vi.fn(),
}));

vi.mock("@/hooks/useDebounced", () => ({
    default: (callback) => callback,
}));

const wrapper = ({ children }) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
};

const searchEnvelope = (items, total = items.length) => ({
    data: { data: items, metadata: { count: total } },
});

describe("useUsersFilterOptions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        fetchUsers.mockResolvedValue({
            data: [
                { id: "u1", nombres: "Ana", apellido1: "Pérez", apellido2: "Gómez" },
                { id: "u2", login: "jperez" },
                { id: null, nombres: "Ghost" },
            ],
            total: 3,
        });
        apiService.post.mockResolvedValue(
            searchEnvelope([{ id: "u3", nombres: "Carlos", apellido1: "Ruiz", apellido2: "" }]),
        );
    });

    it("lista con el baseFilter de users.search y mapea nombre o login", async () => {
        const { result } = renderHook(() => useUsersFilterOptions(), { wrapper });

        await waitFor(() => expect(result.current.usersOptions).toHaveLength(2));

        expect(fetchUsers).toHaveBeenCalledWith({
            filter: [{ field: "usuarios.deleted_at", operator: "null", value: "null", type: "AND" }],
            limit: LIMIT_PAG,
            offset: 0,
            order: { direction: "asc", field: "nombres" },
        });
        expect(result.current.usersOptions).toEqual([
            { id: "u1", label: "Ana Pérez Gómez", value: "u1" },
            { id: "u2", label: "jperez", value: "u2" },
        ]);
    });

    it("busca por nombre en searchByName en vez de OR sueltos sobre /users/search", async () => {
        const { result } = renderHook(() => useUsersFilterOptions(), { wrapper });
        await waitFor(() => expect(fetchUsers).toHaveBeenCalled());

        act(() => {
            result.current.onSearchUsers("Pérez");
        });

        await waitFor(() =>
            expect(apiService.post).toHaveBeenCalledWith("/users/searchByName", {
                name: "Pérez",
            }),
        );
        await waitFor(() =>
            expect(result.current.usersOptions).toEqual([{ id: "u3", label: "Carlos Ruiz", value: "u3" }]),
        );
    });
});
