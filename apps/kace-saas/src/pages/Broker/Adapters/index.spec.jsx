/* eslint-disable react/prop-types */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import useUserInformation from "@/hooks/useUserInformation";
import AdaptersIndex from "./index";

vi.mock("@/hooks/useUserInformation", () => ({ default: vi.fn() }));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key, i18n: { language: "es" } }),
}));

vi.mock("@/components/core/Cards/DashboardSectionCard", () => ({
    DashboardSectionCard: ({ children }) => <div>{children}</div>,
}));

vi.mock("@/components/core/DefaultIndexActions/DefaultIndexActions", () => ({
    default: () => <div data-testid="create-action" />,
}));

vi.mock("./components/AdaptersTableContainer", () => ({
    AdaptersTableContainer: ({ arrayAction }) => (
        <>
            <div data-testid="row-actions">{arrayAction.map((action) => action.permissionName).join(",")}</div>
            <div data-testid="row-labels">{arrayAction.map((action) => action.name).join(",")}</div>
        </>
    ),
}));

vi.mock("./hooks/useAdaptersAction", () => ({
    default: () => ({ handleDelete: vi.fn(), handleSee: vi.fn(), handleUpdate: vi.fn() }),
}));

const permission = (module_id, name) => ({ module_id, name, granted: true });

describe("AdaptersIndex permissions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("grants create and row actions from the broker adapter permissions", () => {
        useUserInformation.mockReturnValue({
            permissionsAdmin: ["Create", "Update", "Delete", "Read"].map((action) =>
                permission("broker_adapters", `BrokerAdapters${action}`),
            ),
        });

        render(<AdaptersIndex />);

        expect(screen.getByTestId("create-action")).toBeInTheDocument();
        expect(screen.getByTestId("row-actions")).toHaveTextContent(
            "BrokerAdaptersRead,BrokerAdaptersUpdate,BrokerAdaptersDelete",
        );
        expect(screen.getByTestId("row-labels")).toHaveTextContent("app.forms.see,app.forms.edit,app.forms.delete");
    });

    it("does not grant adapter actions from banner permissions", () => {
        useUserInformation.mockReturnValue({
            permissionsAdmin: ["Create", "Update", "Delete", "Read"].map((action) =>
                permission("banners", `Banner${action}`),
            ),
        });

        render(<AdaptersIndex />);

        expect(screen.queryByTestId("create-action")).not.toBeInTheDocument();
        expect(screen.getByTestId("row-actions")).toBeEmptyDOMElement();
    });
});
