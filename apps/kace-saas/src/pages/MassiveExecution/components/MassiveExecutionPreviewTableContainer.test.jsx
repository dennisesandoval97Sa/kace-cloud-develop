import { fireEvent, render, screen, within } from "@testing-library/react";
import { useSelector } from "react-redux";
import { beforeEach, describe, expect, it, vi } from "vitest";
import useMassiveExecutionCasesTable from "../hooks/useMassiveExecutionCasesTable";
import useMassiveExecutionClientsTable from "../hooks/useMassiveExecutionClientsTable";
import MassiveExecutionPreviewTableContainer from "./MassiveExecutionPreviewTableContainer";

vi.mock("react-i18next", async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        useTranslation: () => ({
            t: (key) => key,
        }),
    };
});

vi.mock("react-redux", async (importOriginal) => {
    const actual = await importOriginal();

    return {
        ...actual,
        useSelector: vi.fn(),
    };
});

vi.mock("../hooks/useMassiveExecutionCasesTable");
vi.mock("../hooks/useMassiveExecutionClientsTable");

describe("MassiveExecutionPreviewTableContainer", () => {
    beforeEach(() => {
        useSelector.mockReturnValue("");
        useMassiveExecutionCasesTable.mockReturnValue({
            dataTable: [
                {
                    id: "case-1",
                    nivel1: "Infrastructure",
                    nivel2: "Networks",
                    nivel3: "Routing",
                    nivel4: "Border routers",
                    nivel5: "Configuration",
                    nivel6: "BGP",
                    children: [
                        {
                            id: "nivel2",
                            label: "Networks",
                            value: "Networks",
                        },
                        {
                            id: "nivel3",
                            label: "Routing",
                            value: "Routing",
                        },
                        {
                            id: "nivel4",
                            label: "Border routers",
                            value: "Border routers",
                        },
                        {
                            id: "nivel5",
                            label: "Configuration",
                            value: "Configuration",
                        },
                        {
                            id: "nivel6",
                            label: "BGP",
                            value: "BGP",
                        },
                    ],
                },
            ],
            headers: [
                {
                    column_name: "nivel1",
                    label: "Nivel 1",
                    data_type: "string",
                },
            ],
            isLoadingTable: false,
        });
        useMassiveExecutionClientsTable.mockReturnValue({
            dataTable: [],
            headers: [],
            isLoadingTable: false,
        });
    });

    it("shows child classification levels when the user expands a case row", () => {
        render(<MassiveExecutionPreviewTableContainer />);

        expect(screen.queryByText("Networks")).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId("btn_expand_case-1"));

        const expandedRow = screen.getByTestId("data_table_container_row_expanded_0");
        const pathLabels = ["Infrastructure", "Networks", "Routing", "Border routers", "Configuration", "BGP"];
        const pathText = expandedRow.textContent;

        pathLabels.forEach((label) => {
            expect(within(expandedRow).getByText(label)).toBeInTheDocument();
        });
        expect(pathLabels.map((label) => pathText.indexOf(label))).toEqual(
            [...pathLabels].map((label) => pathText.indexOf(label)).sort((left, right) => left - right),
        );
    });
});
