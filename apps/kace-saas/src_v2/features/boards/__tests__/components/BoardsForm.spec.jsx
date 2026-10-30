import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import BoardsForm from "../../components/BoardsForm";

vi.mock("@kace_v2/features/boards/hooks/useOneScriptOptions.hook", () => ({
    default: () => ({
        data: [],
        options: [],
        isLoading: false,
        onSearch: vi.fn(),
        fetchNextPage: vi.fn(),
        hasNextPage: false,
        isFetchingNextPage: false,
    }),
}));

vi.mock("@kace_v2/features/boards/hooks/useBoardsEntities.hook", () => ({
    default: () => ({ data: [], isLoading: false }),
}));

vi.mock("@kace_v2/features/boards/hooks/useBoardsOptions.hook", () => ({
    default: () => ({
        options: { ACTION: [], RESTFLOW: [], ONESCRIPT: [] },
        selectors: {
            ACTION: { options: [], onSearch: vi.fn(), fetchNextPage: vi.fn() },
            RESTFLOW: { options: [], onSearch: vi.fn(), fetchNextPage: vi.fn() },
            ONESCRIPT: { options: [], onSearch: vi.fn(), fetchNextPage: vi.fn() },
        },
    }),
}));

vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({ getSchemaField: () => [] }),
}));

vi.mock("@kace_v2/features/boards/hooks/useAns.hook", () => ({
    default: () => ({ data: [] }),
}));

vi.mock("@kace_v2/shared/ui/organisms/MultiSelectGroups", () => ({
    default: () => <div data-testid="multi-select-groups" />,
}));

vi.mock("@kace_v2/shared/ui/organisms/MultiSelectUsers", () => ({
    default: () => <div data-testid="multi-select-users" />,
}));

vi.mock("@kace_v2/features/boards/components/BoardsOptions", () => ({
    default: () => <div data-testid="boards-options" />,
}));

vi.mock("@kace_v2/features/boards/components/BoardsRelations", () => ({
    default: () => <div data-testid="boards-relations" />,
}));

vi.mock("@kace_v2/features/boards/components/BoardsParameters", () => ({
    default: () => <div data-testid="boards-parameters" />,
}));

vi.mock("@kace_v2/features/boards/components/BoardsHavings", () => ({
    default: () => <div data-testid="boards-havings" />,
}));

vi.mock("@kace_v2/features/boards/components/BoardsSorting", () => ({
    default: () => <div data-testid="boards-sorting" />,
}));

vi.mock("@kace_v2/features/boards/components/BoardsInitialFilter", () => ({
    default: () => <div data-testid="boards-initial-filter" />,
}));

vi.mock("@kace_v2/shared/ui/molecules/SelectIconField", () => ({
    default: () => <div data-testid="select-icon-field" />,
}));

vi.mock("@kace_v2/shared/ui/molecules/SelectField", () => ({
    default: ({ label, onSearch, fetchNextPage }) => (
        <div>
            <button
                type="button"
                data-testid={`select-trigger-${String(label || "")
                    .toLowerCase()
                    .replace(/\s+/g, "-")}`}
            >
                {label}
            </button>
            <span
                data-testid={`select-search-${String(label || "")
                    .toLowerCase()
                    .replace(/\s+/g, "-")}`}
            >
                {typeof onSearch === "function" ? "has-search" : "no-search"}
            </span>
            <span
                data-testid={`select-infinite-${String(label || "")
                    .toLowerCase()
                    .replace(/\s+/g, "-")}`}
            >
                {typeof fetchNextPage === "function" ? "has-infinite" : "no-infinite"}
            </span>
        </div>
    ),
}));

Element.prototype.scrollIntoView = () => {};
Element.prototype.hasPointerCapture = () => false;

const renderForm = (ui) => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter>{ui}</MemoryRouter>
        </QueryClientProvider>,
    );
};

describe("Boards form", () => {
    it("should render form", () => {
        const { getByTestId } = renderForm(<BoardsForm />);
        expect(getByTestId("boards-form")).toBeTruthy();
    });

    it("should render form inputs", () => {
        const { getByTestId } = renderForm(<BoardsForm />);
        expect(getByTestId("boards-form")).toBeTruthy();

        const nameInput = getByTestId("name-input");
        const descriptionInput = getByTestId("description-input");
        const pageSizeInput = getByTestId("page-size-input");
        const isActiveInput = getByTestId("is-active-input");
        const entities = getByTestId("select-trigger-entidades");

        expect(nameInput).toBeInTheDocument();
        expect(descriptionInput).toBeInTheDocument();
        expect(pageSizeInput).toBeInTheDocument();
        expect(isActiveInput).toBeInTheDocument();
        expect(entities).toBeInTheDocument();
    });

    it("el selector de One Script tiene busqueda remota y scroll infinito", () => {
        const { getByTestId } = renderForm(<BoardsForm />);

        expect(getByTestId("select-search-formulario-one-script")).toHaveTextContent("has-search");
        expect(getByTestId("select-infinite-formulario-one-script")).toHaveTextContent("has-infinite");
    });
});
