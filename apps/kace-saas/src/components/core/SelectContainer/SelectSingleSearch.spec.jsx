import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { SelectSingleSearch } from "./SelectSingleSearch";

vi.mock("@/hooks/useGenericSearchQuery", () => ({
    default: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

const selectedUserId = "6f0d7ac9-6f9c-4b69-b3cb-63ec0b935a4a";
const firstPageUser = { id: "1b9d6bcd-bbfd-4b2d-9b5d-ab8dfbbd4bed", label: "Ana Ruiz", value: "Ana Ruiz" };
const selectedUser = { id: selectedUserId, label: "Laura Gómez Pérez", value: "Laura Gómez Pérez" };

// Stable references, as React Query returns them: a new array per render would loop the component's sync effect.
const firstPageResult = { data: [firstPageUser], isLoading: false };
const selectedUserResult = { data: [selectedUser], isLoading: false };

const isSelectedUserLookup = ({ filter }) =>
    filter.some((condition) => condition.field === "id" && condition.value === selectedUserId);

describe("SelectSingleSearch", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        useGenericSearchQuery.mockImplementation((params) =>
            isSelectedUserLookup(params) ? selectedUserResult : firstPageResult,
        );
    });

    it("shows the selected user even when it is not in the first page of users", () => {
        render(<SelectSingleSearch name="user_id" value={selectedUserId} setFieldValue={vi.fn()} />);

        expect(screen.getByRole("button")).toHaveTextContent("Laura Gómez Pérez");
        expect(useGenericSearchQuery).toHaveBeenCalledWith(
            expect.objectContaining({
                url: `${URL_AND_KEYS.users.url}/search`,
                filter: [{ field: "id", operator: "in", value: selectedUserId, type: "AND" }],
                enabled: true,
            }),
        );
    });

    it("does not look up the selected user by id when it is already in the first page", () => {
        render(<SelectSingleSearch name="user_id" value={firstPageUser.id} setFieldValue={vi.fn()} />);

        expect(screen.getByRole("button")).toHaveTextContent("Ana Ruiz");
        expect(useGenericSearchQuery).toHaveBeenCalledWith(
            expect.objectContaining({ searchById: firstPageUser.id, enabled: false }),
        );
    });

    it("does not look up the selected option by id outside the users search", () => {
        render(
            <SelectSingleSearch
                name="schema_id"
                value={selectedUserId}
                setFieldValue={vi.fn()}
                url={URL_AND_KEYS.schemas.url}
                keyQuery={URL_AND_KEYS.schemas.key}
            />,
        );

        const selectedLookup = useGenericSearchQuery.mock.calls.find(([params]) => isSelectedUserLookup(params));
        expect(selectedLookup?.[0].enabled).toBe(false);
    });
});
