import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import LinkedInteractionCasesList from "./LinkedInteractionCasesList";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key, options) =>
            ({
                "interactions.cases.linkedCases": "Linked Cases",
                "interactions.cases.subcase": "Subcase",
                "interactions.cases.viewCase": "View Case",
                "interactions.cases.noLinkedCases": "No linked Cases yet",
            })[key] ??
            options?.defaultValue ??
            key,
    }),
}));

describe("LinkedInteractionCasesList", () => {
    it("renders multiple linked cases with classification summaries and labels subcases", () => {
        render(
            <LinkedInteractionCasesList
                cases={[
                    {
                        id: "case-1",
                        reference: 100,
                        nivel1: "SFTP",
                        nivel2: "Login",
                        nivel4: "Password reset",
                        nivel10: "Remote access",
                        estadoActual: "Open",
                        responsible_name: "Ada Lovelace",
                        parent_id: null,
                    },
                    {
                        id: "case-2",
                        reference: 101,
                        nivel1: "SFTP",
                        nivel3: "Connection timeout",
                        estadoActual: "In progress",
                        responsible_login: "grace.hopper",
                        parent_id: "case-1",
                    },
                ]}
                onViewCase={vi.fn()}
            />,
        );

        expect(screen.getByText("Linked Cases")).toBeInTheDocument();
        expect(screen.getByText("#100")).toBeInTheDocument();
        expect(screen.getByText("#101")).toBeInTheDocument();
        expect(screen.getByText("SFTP / Login / Password reset / Remote access")).toBeInTheDocument();
        expect(screen.getByText("SFTP / Connection timeout")).toBeInTheDocument();
        expect(screen.getByText("Subcase")).toBeInTheDocument();
        expect(screen.getByText("Open")).toBeInTheDocument();
        expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
        expect(screen.getByText("In progress")).toBeInTheDocument();
        expect(screen.getByText("grace.hopper")).toBeInTheDocument();
    });

    it("calls onViewCase with the selected case from a uniquely named View button", async () => {
        const user = userEvent.setup();
        const onViewCase = vi.fn();
        const firstCase = { id: "case-1", reference: 100 };
        const secondCase = { id: "case-2", reference: 101 };

        render(<LinkedInteractionCasesList cases={[firstCase, secondCase]} onViewCase={onViewCase} />);

        const firstButton = screen.getByRole("button", { name: /view case #100/i });
        const secondButton = screen.getByRole("button", { name: /view case #101/i });

        expect(firstButton).toHaveAttribute("id", "linked-case-view-case-1");
        expect(secondButton).toHaveAttribute("id", "linked-case-view-case-2");

        await user.click(secondButton);

        expect(onViewCase).toHaveBeenCalledWith(secondCase);
    });

    it("renders the empty state when no cases are linked", () => {
        render(<LinkedInteractionCasesList cases={[]} onViewCase={vi.fn()} />);

        expect(screen.getByText("Linked Cases")).toBeInTheDocument();
        expect(screen.getByText("No linked Cases yet")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /view case/i })).not.toBeInTheDocument();
    });
});
