import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReOpenCase } from "./ReOpenCase";
import { genericView } from "../../../../../../services/genericView";

vi.mock("../../../../../../services/genericView", () => ({
    genericView: vi.fn(),
}));

vi.mock("../../hooks/useSelectedCase", () => ({
    default: () => ({
        caseSelect: {
            data: {
                id: "case-1",
            },
        },
    }),
}));

vi.mock("./hooks/useReOpenCase", () => ({
    useReopenCase: () => ({
        handleReopenCase: vi.fn(),
        isPending: false,
    }),
}));

vi.mock("../../../../../../components/core/SelectByUrl/SelectByUrl", () => ({
    SelectByUrl: vi.fn(() => null),
}));

vi.mock("@kace/ui-shared", () => ({
    KField: "div",
    DialogFooter: "div",
    Button: "button",
    GeneralLoader: "div",
    TextAreaForm: "textarea",
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "generalSetup.form.labels.state": "Estado",
                "template.form.labels.descripcion": "Descripción",
                "case.placeholder.reopenDescription": "Describe por qué se reabre el caso",
                "button.send": "Enviar",
            })[key] ?? key,
    }),
}));

describe("ReOpenCase", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        genericView.mockResolvedValue({ transicion_id: "transition-current" });
    });

    it("uses the localized reopen description placeholder", async () => {
        render(<ReOpenCase />);

        await waitFor(() => {
            expect(screen.getByPlaceholderText("Describe por qué se reabre el caso")).toBeInTheDocument();
        });
    });
});
