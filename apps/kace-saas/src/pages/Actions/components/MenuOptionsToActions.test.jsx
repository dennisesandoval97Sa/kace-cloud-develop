import React from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MenuOptionsToActions } from "./MenuOptionsToActions";
import { ACTION_MENU_GROUPS } from "../data/constants";

const menuActions = vi.hoisted(() => ({ current: [] }));

vi.mock("../data/constants", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...actual,
        get LIST_FORMS_ACTIONS() {
            return menuActions.current;
        },
    };
});

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

const { LIST_FORMS_ACTIONS: CONFIGURED_ACTIONS } = await vi.importActual("../data/constants");

const ASSIGNMENT_ACTIONS = [
    "ongoingAdvisor",
    "listOfAdvisors",
    "ongoingGroup",
    "groupToExternalCode",
    "groupToDynamicExternalCode",
    "userToExternalCode",
    "userToDynamicExternalCode",
];
const TOP_LEVEL_ACTIONS = ["sendEmail", "updateModel", "webServiceConsumption", "supportModel"];

const setMenuActions = (overridesByValueForm = {}) => {
    menuActions.current = CONFIGURED_ACTIONS.map((item) => ({ ...item, ...overridesByValueForm[item.valueForm] }));
};

const hidden = (...valueForms) => Object.fromEntries(valueForms.map((valueForm) => [valueForm, { hidden: true }]));

const renderMenu = () =>
    render(
        <MemoryRouter>
            <MenuOptionsToActions />
        </MemoryRouter>,
    );

const openAssignmentMenu = async (user) => {
    await user.click(screen.getByTestId("menu_trigger_assignment_actions"));
    return screen.findByRole("menu");
};

describe("MenuOptionsToActions", () => {
    beforeEach(() => {
        setMenuActions();
    });

    it("assigns every configured action to a known menu group", () => {
        const knownGroups = Object.values(ACTION_MENU_GROUPS);

        CONFIGURED_ACTIONS.forEach((item) => {
            expect.soft(knownGroups, item.valueForm).toContain(item.menuGroup);
        });
    });

    it("does not offer the 'assign to list of groups' action", async () => {
        const user = userEvent.setup();
        renderMenu();

        const menu = await openAssignmentMenu(user);

        expect(within(menu).queryByTestId("menu_item_listOfGroups")).not.toBeInTheDocument();
    });

    it("keeps offering the rest of the assignment actions as links to the create page", async () => {
        const user = userEvent.setup();
        renderMenu();

        const menu = await openAssignmentMenu(user);

        ASSIGNMENT_ACTIONS.forEach((valueForm) => {
            const item = within(menu).queryByTestId(`menu_item_${valueForm}`);
            expect.soft(item, valueForm).toHaveAttribute("role", "menuitem");
            expect.soft(item?.closest("a"), valueForm).toHaveAttribute("href", "/actions/create");
        });
    });

    it("groups assignment actions by their menuGroup, not by their position in the list", async () => {
        const [first, ...rest] = CONFIGURED_ACTIONS;
        const movedUserAction = CONFIGURED_ACTIONS.find((item) => item.valueForm === "userToDynamicExternalCode");
        menuActions.current = [movedUserAction, first, ...rest.filter((item) => item !== movedUserAction)];
        const user = userEvent.setup();
        renderMenu();

        const menu = await openAssignmentMenu(user);

        const renderedOrder = within(menu)
            .getAllByRole("menuitem")
            .map((item) => item.dataset.testid);
        expect(renderedOrder).toEqual(
            [
                "ongoingAdvisor",
                "listOfAdvisors",
                "ongoingGroup",
                "groupToExternalCode",
                "groupToDynamicExternalCode",
                "userToDynamicExternalCode",
                "userToExternalCode",
            ].map((valueForm) => `menu_item_${valueForm}`),
        );
        expect(within(menu).getAllByRole("separator")).toHaveLength(2);
        expect(screen.queryByTestId("menu_trigger_userToDynamicExternalCode")).not.toBeInTheDocument();
    });

    it("renders the top-level menu triggers for sendEmail, updateModel, webServiceConsumption and supportModel", () => {
        renderMenu();

        TOP_LEVEL_ACTIONS.forEach((valueForm) => {
            expect.soft(screen.queryByTestId(`menu_trigger_${valueForm}`), valueForm).toBeInTheDocument();
        });
    });

    it("links the enabled top-level actions to the create page", () => {
        renderMenu();

        ["sendEmail", "updateModel", "webServiceConsumption"].forEach((valueForm) => {
            const trigger = screen.getByTestId(`menu_trigger_${valueForm}`);
            expect.soft(within(trigger).queryByRole("link"), valueForm).toHaveAttribute("href", "/actions/create");
        });
    });

    it("renders a disabled top-level action without link and with the translated tooltip", async () => {
        const user = userEvent.setup();
        renderMenu();

        const trigger = screen.getByTestId("menu_trigger_supportModel");
        expect(within(trigger).queryByRole("link")).not.toBeInTheDocument();

        await user.hover(within(trigger).getByText("actions.title.supportModel"));

        expect(await screen.findByRole("tooltip")).toHaveTextContent("actions.messages.optionNotEnabled");
    });

    it("renders a top-level action as disabled only when it declares the flag", () => {
        setMenuActions({ supportModel: { disabled: false }, sendEmail: { disabled: true } });

        renderMenu();

        expect(within(screen.getByTestId("menu_trigger_supportModel")).queryByRole("link")).toBeInTheDocument();
        expect(within(screen.getByTestId("menu_trigger_sendEmail")).queryByRole("link")).not.toBeInTheDocument();
    });

    it("does not render a hidden top-level action", () => {
        setMenuActions(hidden("sendEmail", "supportModel"));

        renderMenu();

        expect(screen.queryByTestId("menu_trigger_sendEmail")).not.toBeInTheDocument();
        expect(screen.queryByTestId("menu_trigger_supportModel")).not.toBeInTheDocument();
        expect(screen.getByTestId("menu_trigger_updateModel")).toBeInTheDocument();
        expect(screen.getByTestId("menu_trigger_webServiceConsumption")).toBeInTheDocument();
    });

    it("renders one separator between each pair of assignment action groups", async () => {
        const user = userEvent.setup();
        renderMenu();

        const menu = await openAssignmentMenu(user);

        expect(within(menu).getAllByRole("separator")).toHaveLength(2);
    });

    it("does not leave a leading separator when the first assignment group is fully hidden", async () => {
        setMenuActions(hidden("ongoingAdvisor", "listOfAdvisors"));
        const user = userEvent.setup();
        renderMenu();

        const menu = await openAssignmentMenu(user);

        expect(within(menu).getAllByRole("separator")).toHaveLength(1);
        expect(within(menu).getAllByRole("menuitem")[0]).toHaveAttribute("data-testid", "menu_item_ongoingGroup");
    });

    it("does not leave a trailing separator when the last assignment group is fully hidden", async () => {
        setMenuActions(hidden("userToExternalCode", "userToDynamicExternalCode"));
        const user = userEvent.setup();
        renderMenu();

        const menu = await openAssignmentMenu(user);

        expect(within(menu).getAllByRole("separator")).toHaveLength(1);
        expect(within(menu).getAllByRole("menuitem").at(-1)).toHaveAttribute(
            "data-testid",
            "menu_item_groupToDynamicExternalCode",
        );
    });

    it("does not render the assignment menu when every assignment action is hidden", () => {
        setMenuActions(hidden("listOfGroups", ...ASSIGNMENT_ACTIONS));

        renderMenu();

        expect(screen.queryByTestId("menu_trigger_assignment_actions")).not.toBeInTheDocument();
        expect(screen.getByTestId("menu_trigger_sendEmail")).toBeInTheDocument();
    });
});
