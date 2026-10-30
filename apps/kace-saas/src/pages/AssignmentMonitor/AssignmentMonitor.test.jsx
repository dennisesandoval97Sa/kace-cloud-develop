import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AssignmentMonitor } from "./AssignmentMonitor";

const mockUseAssignmentRuns = vi.fn();
const dataTableProps = vi.fn();

vi.mock("./hooks/useAssignmentRuns", () => ({
    default: () => mockUseAssignmentRuns(),
}));
vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (key, opts) => opts?.defaultValue ?? key }),
}));
vi.mock("@kace/ui-shared", () => ({
    Button: ({ children, variant: _variant, size: _size, ...props }) => <button {...props}>{children}</button>,
}));
vi.mock("../../components/core/Cards/DashboardSectionCard", () => ({
    DashboardSectionCard: ({ title, children }) => (
        <div>
            <h1>{title}</h1>
            {children}
        </div>
    ),
}));
vi.mock("../../components/ui-shared/src/components/table-component/DataTableContainer", () => ({
    DataTableContainer: (props) => {
        dataTableProps(props);
        return <div data-testid="data-table">rows:{props.dataTable.length}</div>;
    },
}));
vi.mock("./components/RunDetailsModal", () => ({
    default: ({ runId }) => <div data-testid="run-details-modal">{runId}</div>,
}));

const baseHook = {
    runs: [],
    count: 0,
    isLoading: false,
    isFetching: false,
    isError: false,
    refetch: vi.fn(),
    page: 0,
    setPage: vi.fn(),
    pageSize: 10,
    setPageSize: vi.fn(),
    dateFrom: "",
    setDateFrom: vi.fn(),
    dateTo: "",
    setDateTo: vi.fn(),
    status: "",
    setStatus: vi.fn(),
};

describe("AssignmentMonitor", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockUseAssignmentRuns.mockReturnValue(baseHook);
    });

    it("renders title, filters and the table with rows", () => {
        mockUseAssignmentRuns.mockReturnValue({
            ...baseHook,
            runs: [{ id: "r1" }, { id: "r2" }],
        });
        render(<AssignmentMonitor />);
        expect(screen.getByText("assignmentMonitor.title")).toBeInTheDocument();
        expect(screen.getByTestId("assignment_monitor_filters")).toBeInTheDocument();
        expect(screen.getByTestId("data-table")).toHaveTextContent("rows:2");
    });

    it("disables the internal table pagination and generic filter dialog", () => {
        render(<AssignmentMonitor />);
        expect(dataTableProps).toHaveBeenCalledWith(
            expect.objectContaining({ isPagination: false, showFilterGeneric: false }),
        );
    });

    it("forwards the page size to the data table so every fetched row renders", () => {
        mockUseAssignmentRuns.mockReturnValue({ ...baseHook, pageSize: 25 });
        render(<AssignmentMonitor />);
        expect(dataTableProps).toHaveBeenCalledWith(expect.objectContaining({ pageSize: 25 }));
    });

    it("propagates date-time filter changes to the hook", () => {
        render(<AssignmentMonitor />);
        const from = screen.getByTestId("filter_date_from");
        expect(from).toHaveAttribute("type", "datetime-local");
        fireEvent.change(from, { target: { value: "2026-07-20T08:15" } });
        expect(baseHook.setDateFrom).toHaveBeenCalledWith("2026-07-20T08:15");
    });

    it("propagates page-size changes to the hook as a number", () => {
        render(<AssignmentMonitor />);
        fireEvent.change(screen.getByTestId("filter_page_size"), { target: { value: "50" } });
        expect(baseHook.setPageSize).toHaveBeenCalledWith(50);
    });

    it("propagates status filter changes to the hook", () => {
        render(<AssignmentMonitor />);
        fireEvent.change(screen.getByTestId("filter_status"), { target: { value: "error" } });
        expect(baseHook.setStatus).toHaveBeenCalledWith("error");
    });

    it("shows the pager range and disables prev on the first page", () => {
        mockUseAssignmentRuns.mockReturnValue({ ...baseHook, count: 25 });
        render(<AssignmentMonitor />);
        expect(screen.getByTestId("pager_range")).toHaveTextContent("1–10 / 25");
        expect(screen.getByTestId("pager_prev")).toBeDisabled();
        expect(screen.getByTestId("pager_next")).not.toBeDisabled();
    });

    it("advances to the next page from the pager", () => {
        mockUseAssignmentRuns.mockReturnValue({ ...baseHook, count: 25 });
        render(<AssignmentMonitor />);
        fireEvent.click(screen.getByTestId("pager_next"));
        expect(baseHook.setPage).toHaveBeenCalledWith(1);
    });

    it("disables next on the last page and goes back with prev", () => {
        mockUseAssignmentRuns.mockReturnValue({ ...baseHook, count: 25, page: 2 });
        render(<AssignmentMonitor />);
        expect(screen.getByTestId("pager_range")).toHaveTextContent("21–25 / 25");
        expect(screen.getByTestId("pager_next")).toBeDisabled();
        fireEvent.click(screen.getByTestId("pager_prev"));
        expect(baseHook.setPage).toHaveBeenCalledWith(1);
    });
});
