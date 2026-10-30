import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("react-redux", () => ({
    useDispatch: () => vi.fn(),
    useSelector: (selector) => selector({ generalSetup: { configAgent: {} } }),
}));

vi.mock("@kace/hooks/useUserInformation", () => ({
    default: () => ({
        groups: [],
        user: { id: "user-1", external_id: "ext-1", first_name: "Ada", last_name: "Lovelace" },
        permissionsAdmin: [],
        permissionsAgent: [],
    }),
}));

vi.mock("./ui/dropdown-menu", () => ({
    DropdownMenu: ({ children }) => <div>{children}</div>,
    DropdownMenuContent: ({ children }) => <div>{children}</div>,
    DropdownMenuItem: ({ children }) => <div>{children}</div>,
    DropdownMenuLabel: ({ children }) => <div>{children}</div>,
    DropdownMenuSeparator: () => null,
    DropdownMenuTrigger: ({ children }) => <div>{children}</div>,
}));

vi.mock("./ui/avatar", () => ({
    Avatar: ({ children }) => <div>{children}</div>,
    AvatarFallback: ({ children }) => <div>{children}</div>,
    AvatarImage: () => null,
}));

vi.mock("./ui/separator", () => ({ Separator: () => null }));
vi.mock("./ui/tooltip.jsx", () => ({
    Tooltip: ({ children }) => <div>{children}</div>,
    TooltipContent: ({ children }) => <div>{children}</div>,
    TooltipProvider: ({ children }) => <div>{children}</div>,
    TooltipTrigger: ({ children }) => <div>{children}</div>,
}));

vi.mock("sonner", () => ({ toast: { info: vi.fn() } }));
vi.mock("../../../core/AnsUser/AnsUser", () => ({ AnsUser: () => null }));
vi.mock("../../../core/Helps/Helps", () => ({ Helps: () => null }));
vi.mock("../../../core/HighImpactCases/HighImpactCases", () => ({ HighImpactCases: () => null }));
vi.mock("../../../layouts/LogoLayoutContainer", () => ({ LogoLayoutContainer: () => null }));
vi.mock("../../../core/ButtonIcon/ButtonIcon", () => ({
    default: ({ children, id }) => (
        <button type="button" id={id} data-testid={id}>
            {children}
        </button>
    ),
}));

import { PopoverMenuUser } from "./popover-menu-user";

const renderWithHeader = (configHeader, isHeaderLoaded = true) =>
    render(
        <PopoverMenuUser
            configHeader={configHeader}
            isHeaderLoaded={isHeaderLoaded}
            currentApplication="AGENT"
            ansUser={{}}
            helps={[]}
            isLoading={false}
            currentGroup={{ id: "group-1", name: "Group" }}
            setOpenedMyAgenda={vi.fn()}
            logOut={vi.fn()}
            handleChangeApp={vi.fn()}
            handleCurrentPosition={vi.fn()}
        />,
    );

describe("PopoverMenuUser My Agenda icon", () => {
    it("hides the agenda icon when the tenant turned it off", () => {
        renderWithHeader({ my_agenda: false });

        expect(screen.queryByTestId("btn_menu_user_agenda")).not.toBeInTheDocument();
    });

    it("shows the agenda icon when the tenant turned it on", () => {
        renderWithHeader({ my_agenda: true });

        expect(screen.getByTestId("btn_menu_user_agenda")).toBeInTheDocument();
    });

    it("shows the agenda icon for legacy tenants whose saved header has no my_agenda key", () => {
        renderWithHeader({ helps: false, total_cases_by_ans: false });

        expect(screen.getByTestId("btn_menu_user_agenda")).toBeInTheDocument();
    });

    it("hides the agenda icon while the tenant header config is not loaded yet", () => {
        renderWithHeader({ my_agenda: true }, false);

        expect(screen.queryByTestId("btn_menu_user_agenda")).not.toBeInTheDocument();
    });
});
