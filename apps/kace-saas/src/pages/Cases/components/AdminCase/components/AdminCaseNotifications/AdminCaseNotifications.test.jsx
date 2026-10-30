import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminCaseNotifications from "./AdminCaseNotifications";

const mockUseOneScriptUrl = vi.fn();
const mockUseConfigAgentData = vi.fn();
const mockUseAdminCaseParams = vi.fn();
const mockUseUserInformation = vi.fn();

vi.mock("@/pages/Agent/components/TabsClientContainer/hooks/useOneScriptUrl", () => ({
    useOneScriptUrl: (...args) => mockUseOneScriptUrl(...args),
}));

vi.mock("@/hooks/useConfigAgentData", () => ({
    default: () => mockUseConfigAgentData(),
}));

vi.mock("@/pages/Cases/components/AdminCase/hooks/useAdminCaseParams", () => ({
    default: () => mockUseAdminCaseParams(),
}));

vi.mock("@kace/hooks/useUserInformation", () => ({
    default: () => mockUseUserInformation(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("@/components/core/FormOneScript/FormOneScript", () => ({
    FormOneScript: ({ url }) => <iframe data-testid="form_onescript_iframe" src={url} />,
}));

vi.mock("@/componentsV2/core/GeneralLoader", () => ({
    GeneralLoader: () => <div data-testid="general-loader" />,
}));

describe("AdminCaseNotifications", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAdminCaseParams.mockReturnValue({ caseId: "case-123" });
        mockUseUserInformation.mockReturnValue({ user: { id: "user-1" } });
    });

    it("returns null when formId is empty", () => {
        mockUseConfigAgentData.mockReturnValue({ cases: { notifications_one_script_form: "" } });
        mockUseOneScriptUrl.mockReturnValue({ url: "", isLoading: false, error: null });

        const { container } = render(<AdminCaseNotifications />);
        expect(container.innerHTML).toBe("");
    });

    it("shows loader and loading text when isLoading is true", () => {
        mockUseConfigAgentData.mockReturnValue({ cases: { notifications_one_script_form: "form-id" } });
        mockUseOneScriptUrl.mockReturnValue({ formRef: { current: null }, url: "", isLoading: true, error: null });

        render(<AdminCaseNotifications />);
        expect(screen.getByTestId("general-loader")).toBeInTheDocument();
        expect(screen.getByText("genericTexts.loading")).toBeInTheDocument();
    });

    it("shows error message on error", () => {
        mockUseConfigAgentData.mockReturnValue({ cases: { notifications_one_script_form: "form-id" } });
        mockUseOneScriptUrl.mockReturnValue({
            formRef: { current: null },
            url: "",
            isLoading: false,
            error: new Error("fail"),
        });

        render(<AdminCaseNotifications />);
        expect(screen.getByText(/app\.alerts\.NoloadForm/)).toBeInTheDocument();
    });

    it("shows empty state when url is empty and no error", () => {
        mockUseConfigAgentData.mockReturnValue({ cases: { notifications_one_script_form: "form-id" } });
        mockUseOneScriptUrl.mockReturnValue({ formRef: { current: null }, url: "", isLoading: false, error: null });

        render(<AdminCaseNotifications />);
        expect(screen.getByTestId("general-loader")).toBeInTheDocument();
        expect(screen.getByText("app.alerts.formAux")).toBeInTheDocument();
    });

    it("renders FormOneScript when url is available", () => {
        mockUseConfigAgentData.mockReturnValue({ cases: { notifications_one_script_form: "form-id" } });
        mockUseOneScriptUrl.mockReturnValue({
            formRef: { current: null },
            url: "https://onescript.konecta.cloud/render/?schema=f9e3e52d",
            isLoading: false,
            error: null,
        });

        render(<AdminCaseNotifications />);
        expect(screen.getByTestId("form_onescript_iframe")).toBeInTheDocument();
        expect(screen.getByTestId("form_onescript_iframe")).toHaveAttribute(
            "src",
            "https://onescript.konecta.cloud/render/?schema=f9e3e52d",
        );
    });

    it("passes correct params to useOneScriptUrl", () => {
        mockUseConfigAgentData.mockReturnValue({ cases: { notifications_one_script_form: "my-form" } });
        mockUseOneScriptUrl.mockReturnValue({ formRef: { current: null }, url: "", isLoading: false, error: null });

        render(<AdminCaseNotifications />);
        expect(mockUseOneScriptUrl).toHaveBeenCalledWith({
            formId: "my-form",
            clientId: "case-123",
            userId: "user-1",
        });
    });
});
