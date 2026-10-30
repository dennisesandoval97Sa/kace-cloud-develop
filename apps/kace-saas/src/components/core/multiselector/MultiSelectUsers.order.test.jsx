import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { genericSearchService } from "../../../services/genericSearchService";
import { MultiSelectUsers } from "./MultiSelectUsers";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("../../../services/genericSearchService", () => ({
    genericSearchService: vi.fn(),
}));

vi.mock("../../../utils/main", () => ({
    handleFullName: (data) => data,
}));

const users = Array.from({ length: 6 }, (_, index) => {
    const position = String(index + 1).padStart(2, "0");
    return {
        id: `user-${position}`,
        nombres: `User ${position}`,
        email: `user${position}@mail.com`,
    };
});

const orderOfVisibleOptions = async () => {
    const options = await screen.findAllByTestId(/^item_multiselect_users_/);
    return options.map((option) => option.getAttribute("data-testid").replace("item_multiselect_users_", ""));
};

const renderSelector = ({ values = [], groupSelectedFirst = false } = {}) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    const Harness = () => {
        const [selected, setSelected] = useState([]);
        return (
            <MultiSelectUsers
                listValues={selected}
                setListValues={setSelected}
                values={values}
                enableSearch
                groupSelectedFirst={groupSelectedFirst}
            />
        );
    };

    return render(
        <QueryClientProvider client={queryClient}>
            <Harness />
        </QueryClientProvider>,
    );
};

const openSelector = async () => {
    await waitFor(() => {
        expect(screen.getByTestId("trigger_multiselect_users")).not.toBeDisabled();
    });
    fireEvent.click(screen.getByTestId("trigger_multiselect_users"));
    await screen.findByTestId("item_multiselect_users_user-01");
};

describe("MultiSelectUsers — orden del desplegable", () => {
    beforeAll(() => {
        Element.prototype.scrollIntoView = vi.fn();
    });

    beforeEach(() => {
        vi.clearAllMocks();
        genericSearchService.mockImplementation(async (_url, filters = []) => {
            const idFilter = filters.find((filter) => filter.field === "id" && filter.operator === "in");
            const requestedIds = idFilter?.value.split(",").map((id) => id.trim());
            const data = users.filter((user) => !requestedIds || requestedIds.includes(user.id));
            return { data, total: data.length, metadata: { count: data.length } };
        });
    });

    it("conserva el orden del catálogo en creación cuando groupSelectedFirst es false", async () => {
        renderSelector();
        await openSelector();

        fireEvent.click(screen.getByTestId("item_multiselect_users_user-03"));
        fireEvent.click(screen.getByTestId("item_multiselect_users_user-01"));

        expect(await orderOfVisibleOptions()).toEqual([
            "user-01",
            "user-02",
            "user-03",
            "user-04",
            "user-05",
            "user-06",
        ]);
    });

    it("conserva el orden del catálogo en edición cuando groupSelectedFirst es false", async () => {
        renderSelector({ values: [{ id: "user-05" }, { id: "user-02" }] });
        await openSelector();

        expect(await orderOfVisibleOptions()).toEqual([
            "user-01",
            "user-02",
            "user-03",
            "user-04",
            "user-05",
            "user-06",
        ]);
    });

    it("mantiene el comportamiento previo (seleccionados primero) por defecto", async () => {
        renderSelector({ values: [{ id: "user-05" }, { id: "user-02" }], groupSelectedFirst: true });
        await openSelector();

        expect([...(await orderOfVisibleOptions()).slice(0, 2)].sort()).toEqual(["user-02", "user-05"]);
    });
});
