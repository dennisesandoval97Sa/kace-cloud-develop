import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminCaseTabContainer from "./AdminCaseTabContainer";

const mockUseConfigAgentData = vi.fn();
const mockUseAdminCaseParams = vi.fn();

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("@/hooks/useConfigAgentData", () => ({
    default: () => mockUseConfigAgentData(),
}));

vi.mock("../hooks/useAdminCaseParams", () => ({
    default: () => mockUseAdminCaseParams(),
}));

vi.mock("./AdminCaseComments/AdminCaseComments", () => ({
    default: () => <div data-testid="admin-case-comments" />,
}));

vi.mock("./AdminCaseForm", () => ({
    default: () => <div data-testid="admin-case-form" />,
}));

vi.mock("./AdminCaseTransitions/AdminCaseTransitions", () => ({
    default: () => <div data-testid="admin-case-transitions" />,
}));

vi.mock("./AdminCasesCalendar", () => ({
    default: () => <div data-testid="admin-case-calendar" />,
}));

vi.mock("./AdminCaseClient/AdminCaseClient", () => ({
    AdminCaseClient: () => <div data-testid="admin-case-client" />,
}));

vi.mock("./AdminCaseLogs", () => ({
    default: () => <div data-testid="admin-case-logs" />,
}));

vi.mock("@/pages/Cases/components/AdminCase/components/AdminCasesOneScriptKaceComponents", () => ({
    default: () => <div data-testid="admin-case-onescript-kace" />,
}));

vi.mock("@/pages/Cases/components/AdminCase/components/AdminCaseExpressCase", () => ({
    default: () => <div data-testid="admin-case-express" />,
}));

vi.mock("./AdminCaseSubCases/AdminCaseSubCases", () => ({
    default: () => <div data-testid="admin-case-subcases" />,
}));

vi.mock("./AdminCaseInteractions/AdminCaseInteractions", () => ({
    default: () => <div data-testid="admin-case-interactions" />,
}));

vi.mock("./AdminCaseNotifications/AdminCaseNotifications", () => ({
    default: () => <div data-testid="admin-case-notifications" />,
}));

const baseConfig = (casesOverrides = {}) => ({
    cases: {
        show_notifications: false,
        notifications_one_script_form: "",
        ...casesOverrides,
    },
    show_case: true,
    show_client: false,
    show_transitions: false,
    show_subcase: false,
    show_interactions: false,
});

describe("AdminCaseTabContainer notifications tab", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAdminCaseParams.mockReturnValue({ caseId: "case-123", oneScriptFormId: null });
    });

    it("shows notifications tab when show_notifications and notifications_one_script_form are set", () => {
        mockUseConfigAgentData.mockReturnValue(
            baseConfig({ show_notifications: true, notifications_one_script_form: "form-uuid" }),
        );

        render(<AdminCaseTabContainer />);
        expect(screen.getByTestId("adm_case_tab_notifications")).toBeInTheDocument();
    });

    it("hides notifications tab when show_notifications is false", () => {
        mockUseConfigAgentData.mockReturnValue(
            baseConfig({ show_notifications: false, notifications_one_script_form: "form-uuid" }),
        );

        render(<AdminCaseTabContainer />);
        expect(screen.queryByTestId("adm_case_tab_notifications")).not.toBeInTheDocument();
    });

    it("hides notifications tab when notifications_one_script_form is empty", () => {
        mockUseConfigAgentData.mockReturnValue(
            baseConfig({ show_notifications: true, notifications_one_script_form: "" }),
        );

        render(<AdminCaseTabContainer />);
        expect(screen.queryByTestId("adm_case_tab_notifications")).not.toBeInTheDocument();
    });

    it("hides notifications tab when both flags are off", () => {
        mockUseConfigAgentData.mockReturnValue(
            baseConfig({ show_notifications: false, notifications_one_script_form: "" }),
        );

        render(<AdminCaseTabContainer />);
        expect(screen.queryByTestId("adm_case_tab_notifications")).not.toBeInTheDocument();
    });

    it("disables notifications tab when caseId is missing", () => {
        mockUseConfigAgentData.mockReturnValue(
            baseConfig({ show_notifications: true, notifications_one_script_form: "form-uuid" }),
        );
        mockUseAdminCaseParams.mockReturnValue({ caseId: null, oneScriptFormId: null });

        render(<AdminCaseTabContainer />);
        expect(screen.getByTestId("adm_case_tab_notifications")).toBeDisabled();
    });
});
