import { memo, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { LoaderThreeDots } from "@/components/ui-shared";

const DataTablePagination = ({
    page = 1,
    totalPages = 1,
    totalRecords = 0,
    pageSize = 10,
    pageSizeOptions = [10, 25, 50, 75, 100],
    onFirstPage,
    onPreviousPage,
    canPreviousPage,
    onNextPage,
    canNextPage,
    onLastPage,
    onJumpBackward,
    onJumpForward,
    onGoToPage,
    onPageSizeChange,
    isFetching = false,
}) => {
    const { t } = useTranslation();
    const pageSizeLabel = t("dataTable.pagination.pageSize");
    const goToPageLabel = t("dataTable.pagination.goToPage");
    const [pageInputValue, setPageInputValue] = useState(String(page));

    useEffect(() => {
        setPageInputValue(String(page));
    }, [page]);

    const isSinglePage = totalPages <= 1;

    const pageButtons = useMemo(() => {
        if (totalPages <= 1) return [1];

        const maxVisiblePages = 5;
        const halfWindow = Math.floor(maxVisiblePages / 2);
        let start = Math.max(1, page - halfWindow);
        let end = Math.min(totalPages, start + maxVisiblePages - 1);

        if (end - start + 1 < maxVisiblePages) {
            start = Math.max(1, end - maxVisiblePages + 1);
        }

        return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }, [page, totalPages]);

    const handlePageSizeChange = (event) => {
        onPageSizeChange?.(Number(event.target.value));
    };

    const handleGoToPageSubmit = () => {
        if (!pageInputValue.trim()) return;

        const nextPage = Number(pageInputValue);

        if (!Number.isFinite(nextPage)) {
            setPageInputValue(String(page));
            return;
        }

        onGoToPage?.(nextPage);
    };

    return (
        <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex flex-col rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-left shadow-sm">
                    <span className="text-base font-semibold text-foreground sm:text-lg">
                        {t("dataTable.pagination.pageOf", { page, totalPages })}
                    </span>
                    <span className="text-sm font-medium text-foreground/80 sm:text-base">
                        {t("dataTable.pagination.records", { totalRecords })}
                    </span>
                </div>
                {onPageSizeChange && (
                    <label className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                        <span>{pageSizeLabel}</span>
                        <select
                            aria-label={pageSizeLabel}
                            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm text-foreground shadow-sm"
                            value={pageSize}
                            onChange={handlePageSizeChange}
                            disabled={isFetching}
                        >
                            {pageSizeOptions.map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </label>
                )}
            </div>
            <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
                {onFirstPage && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onFirstPage}
                        disabled={isSinglePage || page === 1 || isFetching}
                        id="btn_pg_first_page"
                        data-testid="btn_pg_first_page"
                    >
                        {t("dataTable.pagination.first")}
                    </Button>
                )}
                {onJumpBackward && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onJumpBackward}
                        disabled={isSinglePage || page === 1 || isFetching}
                        id="btn_pg_jump_backward"
                        data-testid="btn_pg_jump_backward"
                        aria-label={t("dataTable.pagination.jumpBackwardAriaLabel")}
                    >
                        {t("dataTable.pagination.jumpBackward")}
                    </Button>
                )}
                <Button
                    type="button"
                    variant="outline"
                    onClick={onPreviousPage}
                    disabled={!canPreviousPage || isFetching}
                    id="btn_pg_previous_page"
                    data-testid="btn_pg_previous_page"
                >
                    {t("button.previous")}
                </Button>
                {onGoToPage && (
                    <div className="flex items-center gap-1">
                        {pageButtons.map((pageNumber) => (
                            <Button
                                type="button"
                                key={pageNumber}
                                variant={pageNumber === page ? "default" : "outline"}
                                onClick={() => onGoToPage(pageNumber)}
                                disabled={isFetching}
                                id={`btn_pg_number_${pageNumber}`}
                                data-testid={`btn_pg_number_${pageNumber}`}
                            >
                                {pageNumber}
                            </Button>
                        ))}
                    </div>
                )}
                {onGoToPage && (
                    <div className="flex items-center gap-2">
                        <input
                            type="number"
                            min={1}
                            max={totalPages}
                            value={pageInputValue}
                            onChange={(event) => setPageInputValue(event.target.value)}
                            className="h-9 w-20 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                            id="data_table_go_to_page"
                            data-testid="input_pg_go_to_page"
                            aria-label={goToPageLabel}
                            disabled={isFetching}
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleGoToPageSubmit}
                            disabled={isFetching || isSinglePage}
                            id="btn_pg_go_to_page"
                            data-testid="btn_pg_go_to_page"
                        >
                            {t("dataTable.pagination.go")}
                        </Button>
                    </div>
                )}
                <Button
                    type="button"
                    variant="outline"
                    onClick={onNextPage}
                    disabled={!canNextPage || isFetching}
                    id="btn_pg_next_page"
                    data-testid="btn_pg_next_page"
                >
                    {isFetching ? <LoaderThreeDots /> : t("button.next")}
                </Button>
                {onJumpForward && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onJumpForward}
                        disabled={isSinglePage || page === totalPages || isFetching}
                        id="btn_pg_jump_forward"
                        data-testid="btn_pg_jump_forward"
                        aria-label={t("dataTable.pagination.jumpForwardAriaLabel")}
                    >
                        {t("dataTable.pagination.jumpForward")}
                    </Button>
                )}
                {onLastPage && (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onLastPage}
                        disabled={isSinglePage || page === totalPages || isFetching}
                        id="btn_pg_last_page"
                        data-testid="btn_pg_last_page"
                    >
                        {t("dataTable.pagination.last")}
                    </Button>
                )}
            </div>
        </div>
    );
};

DataTablePagination.propTypes = {
    page: PropTypes.number,
    totalPages: PropTypes.number,
    totalRecords: PropTypes.number,
    pageSize: PropTypes.number,
    pageSizeOptions: PropTypes.arrayOf(PropTypes.number),
    onFirstPage: PropTypes.func,
    onPreviousPage: PropTypes.func.isRequired,
    canPreviousPage: PropTypes.bool.isRequired,
    onNextPage: PropTypes.func.isRequired,
    canNextPage: PropTypes.bool.isRequired,
    onLastPage: PropTypes.func,
    onJumpBackward: PropTypes.func,
    onJumpForward: PropTypes.func,
    onGoToPage: PropTypes.func,
    onPageSizeChange: PropTypes.func,
    isFetching: PropTypes.bool,
};

export default memo(DataTablePagination);
