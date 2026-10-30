import { render, screen } from "@testing-library/react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { SubMenuBar } from "./SubMenuBar";

const { store, loc, agendaMounts } = vi.hoisted(() => ({
    store: { current: { generalSetup: { configAgent: null } } },
    loc: { current: { pathname: "/agent/cases" } },
    agendaMounts: { count: 0 },
}));

vi.mock("react-redux", () => ({
    useSelector: (selector) => selector(store.current),
}));

vi.mock("react-router-dom", () => ({
    useLocation: () => loc.current,
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("../../hooks/useUserInformation", () => ({
    default: () => ({ user: { id: "user-1", selectedGroup: "group-1" }, groups: [] }),
}));

vi.mock("../core/AnsUser/AnsUser", () => ({ AnsUser: () => null }));
vi.mock("../core/AnsUser/hooks/useAnsUserData", () => ({ useAnsUserData: () => ({ ansUser: {} }) }));
vi.mock("../core/Helps/Helps", () => ({ Helps: () => null }));
vi.mock("../core/Helps/hooks/useHelpsData", () => ({ useHelpsData: () => ({ helps: [], isLoading: false }) }));
vi.mock("../core/HighImpactCases/HighImpactCases", () => ({ HighImpactCases: () => null }));
vi.mock("../core/SearchClient/SearchClient", () => ({
    default: () => <div data-testid="search-client" />,
}));
vi.mock("@/components/core/AdvancedSearch", () => ({ default: () => <div data-testid="advanced-search" /> }));
vi.mock("./LogoLayoutContainer", () => ({ LogoLayoutContainer: () => null }));
vi.mock("../ui-shared", () => ({ cn: (...args) => args.filter(Boolean).join(" "), PopoverMenuUser: () => null }));
vi.mock("../core/MyAgenda/hooks/useMyAgenda", () => ({ default: () => ({ setOpenedMyAgenda: vi.fn() }) }));
vi.mock("../core/ButtonIcon/ButtonIcon", () => ({
    default: ({ children, id }) => {
        if (id === "btn_sub_menu_diary") {
            agendaMounts.count += 1;
        }
        return (
            <button type="button" id={id} data-testid={id}>
                {children}
            </button>
        );
    },
}));

const renderAgentBar = (configAgent) => {
    store.current = { generalSetup: { configAgent } };
    render(<SubMenuBar currentApplication="AGENT" />);
};

const renderWithHeader = (header, { pathname = "/agent/cases", currentApplication = "AGENT" } = {}) => {
    loc.current = { pathname };
    store.current = { generalSetup: { configAgent: header === undefined ? null : { header } } };
    render(<SubMenuBar currentApplication={currentApplication} />);
};

beforeEach(() => {
    loc.current = { pathname: "/agent/cases" };
    store.current = { generalSetup: { configAgent: null } };
    agendaMounts.count = 0;
});

describe("SubMenuBar client search", () => {
    it("shows SearchClient when show_client_data is true even if header.search_clients is false", () => {
        renderAgentBar({
            header: { search_clients: false },
            agent: { show_client_data: true },
        });

        expect(screen.getByTestId("search-client")).toBeInTheDocument();
    });

    it("hides SearchClient when show_client_data is false even if header.search_clients is true", () => {
        renderAgentBar({
            header: { search_clients: true },
            agent: { show_client_data: false },
        });

        expect(screen.queryByTestId("search-client")).not.toBeInTheDocument();
    });

    it("hides SearchClient while agent config is not loaded yet", () => {
        renderAgentBar(null);

        expect(screen.queryByTestId("search-client")).not.toBeInTheDocument();
    });
});

describe("SubMenuBar My Agenda icon", () => {
    it("hides the agenda icon when the tenant turned it off", () => {
        renderWithHeader({ my_agenda: false });

        expect(screen.queryByTestId("btn_sub_menu_diary")).not.toBeInTheDocument();
    });

    it("shows the agenda icon when the tenant turned it on", () => {
        renderWithHeader({ my_agenda: true });

        expect(screen.getByTestId("btn_sub_menu_diary")).toBeInTheDocument();
    });

    it("shows the agenda icon for legacy tenants whose saved header has no my_agenda key", () => {
        renderWithHeader({ helps: false, search_clients: false });

        expect(screen.getByTestId("btn_sub_menu_diary")).toBeInTheDocument();
    });

    it("hides the agenda icon while the tenant header config is not loaded yet", () => {
        renderWithHeader();

        expect(screen.queryByTestId("btn_sub_menu_diary")).not.toBeInTheDocument();
    });

    it("hides the agenda icon when AGENT is selected but the route is not /agent and the tenant turned it off", () => {
        renderWithHeader({ my_agenda: false, helps: false }, { pathname: "/dashboard" });

        expect(screen.queryByTestId("btn_sub_menu_diary")).not.toBeInTheDocument();
    });

    it.each([
        ["AGENT", "/agent/cases"],
        ["AGENT", "/dashboard"],
        ["ADMIN", "/agent/cases"],
        ["ADMIN", "/dashboard"],
    ])(
        "does not mount the agenda icon even once when my_agenda is false (app=%s path=%s)",
        (currentApplication, pathname) => {
            renderWithHeader({ my_agenda: false }, { pathname, currentApplication });

            expect(agendaMounts.count).toBe(0);
            expect(screen.queryByTestId("btn_sub_menu_diary")).not.toBeInTheDocument();
        },
    );
});
