import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FilterCustomization } from "./FilterCustomization";

vi.mock("react-redux", () => ({ useSelector: () => "Title" }));
vi.mock("react-router-dom", () => ({ useLocation: () => ({ pathname: "/cases" }) }));
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key) => key }) }));

const mocks = vi.hoisted(() => ({ dataFiltersUser: null }));

vi.mock("./hooks/useHookFilter", () => ({
    default: () => ({
        modalNewFilter: true,
        toastAlertFilter: null,
        onSubmit: vi.fn(),
        handleSelectFilter: vi.fn(),
        handleDeleteFilter: vi.fn(),
        dataFiltersUser: mocks.dataFiltersUser,
        handleNewFilter: vi.fn().mockResolvedValue(true),
        setModalNewFilter: vi.fn(),
        handleHelpers: vi.fn(),
        handleClear: vi.fn(),
    }),
}));

describe("FilterCustomization new-filter dialog duplicate-name check (legacy admin fallback)", () => {
    beforeEach(() => {
        mocks.dataFiltersUser = null;
    });

    it("flags a legacy-admin-only filter name as a duplicate for a user with no agente filters yet", async () => {
        const user = userEvent.setup();
        mocks.dataFiltersUser = {
            filters: { application: { admin: { cases: { Legacy: { reference: "1" } } } } },
        };

        render(<FilterCustomization nameTable={{ view: "cases", url: "/cases" }} />);

        await user.type(screen.getByTestId("input_name"), "Legacy");

        expect(screen.getByText("app.text.filterNameExists")).toBeInTheDocument();
    });

    it("does not flag a brand-new name as a duplicate", async () => {
        const user = userEvent.setup();
        mocks.dataFiltersUser = {
            filters: { application: { admin: { cases: { Legacy: { reference: "1" } } } } },
        };

        render(<FilterCustomization nameTable={{ view: "cases", url: "/cases" }} />);

        await user.type(screen.getByTestId("input_name"), "BrandNewName");

        expect(screen.queryByText("app.text.filterNameExists")).not.toBeInTheDocument();
    });

    it("still flags a duplicate when the name already exists in the current scope directly (no fallback needed)", async () => {
        const user = userEvent.setup();
        mocks.dataFiltersUser = {
            filters: { application: { agente: { cases: { Mine: { reference: "1" } } } } },
        };

        render(<FilterCustomization nameTable={{ view: "cases", url: "/cases" }} />);

        await user.type(screen.getByTestId("input_name"), "Mine");

        expect(screen.getByText("app.text.filterNameExists")).toBeInTheDocument();
    });
});
