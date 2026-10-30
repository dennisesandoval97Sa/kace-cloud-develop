import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import useDataTable from "@/hooks/useDataTable";
import { SYSTEM_INBOX_WORKSPACE_ID } from "@/utils/systemInboxWorkspace";
import { WorkspaceTableContainer } from "./WorkspaceTableContainer";

vi.mock("@/hooks/useDataTable", () => ({ default: vi.fn() }));
vi.mock("@/componentsV2/core/DataTable", () => ({ default: () => <div data-testid="table" /> }));

describe("WorkspaceTableContainer", () => {
    it("appends the protected workspace exclusion after URL or saved filters", () => {
        useDataTable.mockReturnValue({
            renderData: {},
            query: {},
            filters: {},
            pagination: {},
            columnSelector: {},
        });

        render(<WorkspaceTableContainer />);

        const transform = useDataTable.mock.calls[0][0].transformFiltersBeforeQuery;
        const resolvedFilters = [
            { field: "id", operator: "eq", value: SYSTEM_INBOX_WORKSPACE_ID, type: "AND" },
            { field: "description", operator: "ilike", value: "Inbox", type: "AND" },
        ];

        expect(transform(resolvedFilters)).toEqual([
            ...resolvedFilters,
            { field: "id", operator: "neq", value: SYSTEM_INBOX_WORKSPACE_ID, type: "AND" },
        ]);
    });
});
