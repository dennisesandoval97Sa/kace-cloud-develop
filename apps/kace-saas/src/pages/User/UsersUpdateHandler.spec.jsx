import { render, screen, act } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import UsersUpdateHandler from "./UsersUpdateHandler";
import useGeneralMutation from "../../hooks/useGeneralMutation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "react-router-dom";

vi.mock("react-redux", () => ({
    useDispatch: () => vi.fn(),
}));

vi.mock("react-router-dom", () => ({
    useParams: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) => key,
    }),
}));

vi.mock("@tanstack/react-query", () => ({
    useQuery: vi.fn(),
    useQueryClient: vi.fn(),
}));

vi.mock("../../hooks/useGeneralMutation", () => ({
    default: vi.fn(),
}));

vi.mock("./components/UserForm", () => ({
    default: ({ dataHandler }) => (
        <button
            type="button"
            data-testid="submit-user"
            onClick={() =>
                dataHandler(
                    {
                        id: "user-123",
                        rol_id: "new-role-456",
                        groups: ["group-1"],
                        account_type: "1",
                    },
                    vi.fn(),
                    vi.fn(),
                    ["group-1"],
                )
            }
        >
            Submit
        </button>
    ),
}));

vi.mock("../../utils/main", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        apiService: {
            get: vi.fn().mockResolvedValue({ data: { data: {} } }),
            post: vi.fn().mockResolvedValue({ status: 200 }),
        },
    };
});

vi.mock("sonner", () => ({
    toast: {
        info: vi.fn(),
        warning: vi.fn(),
        success: vi.fn(),
    },
}));

const STATIC_USER_DATA = {
    id: "user-123",
    rol_id: "old-role-111",
    account_type: "1",
    groups: [{ id: "group-1", label: "group-1", value: "group-1" }],
};

const STATIC_GROUPS_DATA = {
    data: { items: [] },
};

const STATIC_USER_QUERY = {
    data: STATIC_USER_DATA,
    isLoading: false,
};

const STATIC_GROUPS_QUERY = {
    data: STATIC_GROUPS_DATA,
    isLoading: false,
};

const STATIC_EMPTY_QUERY = {
    data: null,
    isLoading: false,
};

describe("UsersUpdateHandler - Self Edit and Role Refetch", () => {
    let mockMutate;
    let mockQueryClient;

    beforeEach(() => {
        vi.clearAllMocks();
        mockMutate = vi.fn();
        mockQueryClient = {
            getQueryData: vi.fn((key) => {
                if (key[0] === "userInformation") {
                    return { user: { id: "user-123", rol_id: "old-role-111" } };
                }
                return null;
            }),
            setQueryData: vi.fn(),
            invalidateQueries: vi.fn(),
            refetchQueries: vi.fn(),
            removeQueries: vi.fn(),
        };

        useParams.mockReturnValue({ id: "user-123" });
        useQueryClient.mockReturnValue(mockQueryClient);
        useGeneralMutation.mockReturnValue({
            mutate: mockMutate,
            isPending: false,
        });

        useQuery.mockImplementation(({ queryKey }) => {
            if (queryKey[0] === "userForm") {
                return STATIC_USER_QUERY;
            }
            if (queryKey[0] === "groupsByUser") {
                return STATIC_GROUPS_QUERY;
            }
            return STATIC_EMPTY_QUERY;
        });
    });

    it("invalidates and refetches userInformation when self-editing and updating rol_id", async () => {
        render(<UsersUpdateHandler />);

        const submitBtn = screen.getByTestId("submit-user");

        await act(async () => {
            submitBtn.click();
        });

        expect(mockMutate).toHaveBeenCalled();

        // Simulate mutation onSuccess
        const mutationOptions = mockMutate.mock.calls[0][1];
        await act(async () => {
            await mutationOptions.onSuccess();
        });

        expect(mockQueryClient.setQueryData).toHaveBeenCalledWith(["userInformation"], expect.any(Function));
        expect(mockQueryClient.invalidateQueries).toHaveBeenCalledWith({
            queryKey: ["userInformation"],
        });
        expect(mockQueryClient.refetchQueries).toHaveBeenCalledWith({
            queryKey: ["userInformation"],
        });
    });
});
