import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@kace/ui-shared";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import { DataTableContainer } from "../../components/ui-shared/src/components/table-component/DataTableContainer";
import { URL_AND_KEYS } from "../../utils/urlAndKeys";
import useAssignmentRuns from "./hooks/useAssignmentRuns";
import { buildRunColumns } from "./components/runColumns";
import RunDetailsModal from "./components/RunDetailsModal";

export const AssignmentMonitor = () => {
    const { t } = useTranslation();
    const [selectedRun, setSelectedRun] = useState(null);
    const {
        runs,
        count,
        isLoading,
        isFetching,
        isError,
        refetch,
        page,
        setPage,
        pageSize,
        setPageSize,
        dateFrom,
        setDateFrom,
        dateTo,
        setDateTo,
        status,
        setStatus,
    } = useAssignmentRuns();

    const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

    const columns = buildRunColumns(t, setSelectedRun);

    return (
        <DashboardSectionCard title={t("assignmentMonitor.title")}>
            <div className="flex flex-col gap-4 p-4 w-full bg-background shadow-md rounded-md">
                <div className="flex flex-wrap gap-4 items-end" data-testid="assignment_monitor_filters">
                    <label className="flex flex-col text-sm gap-1">
                        {t("assignmentMonitor.filters.from")}
                        <input
                            type="datetime-local"
                            className="border border-input rounded-md p-1"
                            value={dateFrom}
                            data-testid="filter_date_from"
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col text-sm gap-1">
                        {t("assignmentMonitor.filters.to")}
                        <input
                            type="datetime-local"
                            className="border border-input rounded-md p-1"
                            value={dateTo}
                            data-testid="filter_date_to"
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </label>
                    <label className="flex flex-col text-sm gap-1">
                        {t("assignmentMonitor.filters.status")}
                        <select
                            className="border border-input rounded-md p-1"
                            value={status}
                            data-testid="filter_status"
                            onChange={(e) => setStatus(e.target.value)}
                        >
                            <option value="">{t("assignmentMonitor.filters.all")}</option>
                            <option value="completed">{t("assignmentMonitor.statuses.completed")}</option>
                            <option value="no_actions">{t("assignmentMonitor.statuses.no_actions")}</option>
                            <option value="no_eligible_actions">
                                {t("assignmentMonitor.statuses.no_eligible_actions")}
                            </option>
                            <option value="already_running">{t("assignmentMonitor.statuses.already_running")}</option>
                            <option value="error">{t("assignmentMonitor.statuses.error")}</option>
                        </select>
                    </label>
                </div>
                <DataTableContainer
                    columns={columns}
                    isPagination={false}
                    pageSize={pageSize}
                    showFilterGeneric={false}
                    view={URL_AND_KEYS.assignmentRuns}
                    isLoadingTable={isLoading}
                    dataTable={runs}
                    isFetching={isFetching}
                    refresh={refetch}
                    errorData={isError}
                    columnsToFilter={[]}
                />
                <div className="flex items-center justify-end gap-2" data-testid="assignment_monitor_pager">
                    <label className="flex items-center gap-1 text-sm mr-auto">
                        {t("assignmentMonitor.filters.pageSize")}
                        <select
                            className="border border-input rounded-md p-1"
                            value={pageSize}
                            data-testid="filter_page_size"
                            onChange={(e) => setPageSize(Number(e.target.value))}
                        >
                            {PAGE_SIZE_OPTIONS.map((size) => (
                                <option key={size} value={size}>
                                    {size}
                                </option>
                            ))}
                        </select>
                    </label>
                    <span className="text-sm" data-testid="pager_range">
                        {page * pageSize + 1}–{Math.min((page + 1) * pageSize, count)} / {count}
                    </span>
                    <Button
                        variant="outline"
                        size="sm"
                        data-testid="pager_prev"
                        disabled={page === 0}
                        onClick={() => setPage(page - 1)}
                    >
                        ‹
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        data-testid="pager_next"
                        disabled={(page + 1) * pageSize >= count}
                        onClick={() => setPage(page + 1)}
                    >
                        ›
                    </Button>
                </div>
                {selectedRun && (
                    <RunDetailsModal
                        isOpen={!!selectedRun}
                        onClose={() => setSelectedRun(null)}
                        runId={selectedRun.id}
                    />
                )}
            </div>
        </DashboardSectionCard>
    );
};
