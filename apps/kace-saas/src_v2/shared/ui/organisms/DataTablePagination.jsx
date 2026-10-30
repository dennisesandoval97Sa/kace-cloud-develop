import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import Button from "@kace_v2/shared/ui/atoms/Button";

const DataTablePagination = ({
    onPreviousPage = () => {},
    onNextPage = () => {},
    canPreviousPage = false,
    canNextPage = true,
    isFetching,
    page = 1,
    totalPages = 1,
    totalRecords = 0,
    onFirstPage = () => {},
    onLastPage = () => {},
    onGoToPage = () => {},
}) => {
    const { t } = useTranslation();
    const [inputPage, setInputPage] = useState(String(page));

    useEffect(() => {
        setInputPage(String(page));
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

    const handleSubmitGoToPage = () => {
        if (!inputPage.trim()) return;
        onGoToPage(inputPage);
    };

    return (
        <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-left shadow-sm">
                <span className="text-base font-semibold text-foreground sm:text-lg">
                    {t("boards.pagination.pageOf", { page, totalPages })}
                </span>
                <span className="text-sm font-medium text-foreground/80 sm:text-base">
                    {t("boards.pagination.records", { totalRecords })}
                </span>
            </div>
            <div className="flex w-full flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end">
                <Button
                    type="button"
                    variant="outline"
                    onClick={onFirstPage}
                    disabled={isSinglePage || page === 1 || isFetching}
                    id="btn_pg_first_page"
                    data-testid="btn_pg_first_page"
                >
                    {t("boards.pagination.first")}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onPreviousPage}
                    disabled={!canPreviousPage || isFetching}
                    id="btn_pg_previous_page"
                    data-testid="btn_pg_previous_page"
                >
                    {t("boards.pagination.previous")}
                </Button>
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
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        min={1}
                        max={totalPages}
                        value={inputPage}
                        onChange={(event) => setInputPage(event.target.value)}
                        className="h-9 w-20 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                        id="input_pg_go_to_page"
                        data-testid="input_pg_go_to_page"
                    />
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleSubmitGoToPage}
                        disabled={isFetching || isSinglePage}
                        id="btn_pg_go_to_page"
                        data-testid="btn_pg_go_to_page"
                    >
                        {t("boards.pagination.go")}
                    </Button>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onNextPage}
                    disabled={!canNextPage || isFetching}
                    id="btn_pg_next_page"
                    data-testid="btn_pg_next_page"
                >
                    {t("boards.pagination.next")}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    onClick={onLastPage}
                    disabled={isSinglePage || page === totalPages || isFetching}
                    id="btn_pg_last_page"
                    data-testid="btn_pg_last_page"
                >
                    {t("boards.pagination.last")}
                </Button>
            </div>
        </div>
    );
};

DataTablePagination.propTypes = {
    onPreviousPage: PropTypes.func,
    canPreviousPage: PropTypes.bool,
    onNextPage: PropTypes.func,
    canNextPage: PropTypes.bool,
    isFetching: PropTypes.bool,
    page: PropTypes.number,
    totalPages: PropTypes.number,
    totalRecords: PropTypes.number,
    onFirstPage: PropTypes.func,
    onLastPage: PropTypes.func,
    onGoToPage: PropTypes.func,
};

export default DataTablePagination;
