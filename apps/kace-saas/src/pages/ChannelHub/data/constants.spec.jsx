import { render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useDataTableColumns } from "@/hooks/useDataTableColumns";
import { dataTableConfig } from "./constants";
import { processColumns } from "../utils/datatableProcess";

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (_key, fallback) => fallback,
    }),
}));

vi.mock("@/hooks/useApiMetaData", () => ({
    default: () => ({
        urlRedirect: "/channel-hub/update",
    }),
}));

const channelHubSchema = [
    { column_name: "name", data_type: "character varying" },
    { column_name: "email", data_type: "character varying" },
    { column_name: "country_id", data_type: "character varying" },
    { column_name: "channel_hub_connection_id", data_type: "character varying" },
    { column_name: "created_at", data_type: "timestamp with time zone" },
];

const renderColumnCell = (column) => {
    const row = {
        original: {
            id: "account-id",
            name: "Juan Zapata",
            country_id: "CO",
            channel_hub_connection_id: "ch-connection-123",
        },
    };

    const Cell = () => column.cell({ row });

    render(
        <MemoryRouter>
            <Cell />
        </MemoryRouter>,
    );
};

describe("Channel Hub table columns", () => {
    it("renders id-suffixed data columns with their own values instead of the account name", () => {
        const { result } = renderHook(() =>
            useDataTableColumns({
                rawSchema: channelHubSchema,
                dataTableConfig,
                processColumns,
            }),
        );

        renderColumnCell(result.current.columns.find((column) => column.accessorKey === "country_id"));
        expect(screen.getByText("CO")).toBeInTheDocument();
        expect(screen.queryByText("Juan Zapata")).not.toBeInTheDocument();

        renderColumnCell(result.current.columns.find((column) => column.accessorKey === "channel_hub_connection_id"));
        expect(screen.getByText("ch-connection-123")).toBeInTheDocument();
    });
});
