import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import InputsCasesContainer from "./InputsCasesContainer";

Element.prototype.scrollIntoView = () => {};
Element.prototype.hasPointerCapture = () => false;

global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key) => key }),
}));

vi.mock("@/hooks/useSchemaFields", () => ({
    default: () => ({
        schemaFields: {
            view_casos: [],
            view_case_details: [],
            cases: [],
        },
    }),
}));

describe("InputsCasesContainer", () => {
    it("shows the selected view label when a custom view is enabled", () => {
        render(
            <InputsCasesContainer
                values={{ enable_admin_custom_view: true, admin_custom_view_name: "view_casos" }}
                setFieldValue={vi.fn()}
            />,
        );

        expect(screen.getByText("view_casos")).toBeInTheDocument();
    });

    it("does not render the view selector when custom view is disabled", () => {
        render(
            <InputsCasesContainer
                values={{ enable_admin_custom_view: false, admin_custom_view_name: "" }}
                setFieldValue={vi.fn()}
            />,
        );

        expect(screen.queryByText("view_casos")).not.toBeInTheDocument();
    });
});
