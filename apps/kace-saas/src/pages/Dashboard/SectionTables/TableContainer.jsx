import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious,
    GeneralLoader,
} from "@kace/ui-shared";
import PropTypes from "prop-types";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { formatTestId } from "@/utils/src/helpers";

export const TableContainer = ({ dataTable = [], columns = [], rowsPerPage = 10, loading = false }) => {
    const { t } = useTranslation();
    const [currentPage, setCurrentPage] = useState(1);
    const list = dataTable ?? [];
    const totalPages = Math.ceil(list.length / rowsPerPage);

    const startIndex = (currentPage - 1) * rowsPerPage;
    const currentData = list.slice(startIndex, startIndex + rowsPerPage);

    const caption =
        list.length === 0
            ? t("dashboard.tables.empty")
            : t("dataTable.pagination.caption", { page: currentPage, totalPages, totalRecords: list.length });

    const handlePageChange = (pageNumber) => {
        if (pageNumber >= 1 && pageNumber <= totalPages) {
            setCurrentPage(pageNumber);
        }
    };

    const getVisiblePages = () => {
        const pages = [];
        const maxVisible = 5;
        const start = Math.max(1, currentPage - 2);
        const end = Math.min(totalPages, currentPage + 2);

        if (currentPage <= 3) {
            for (let i = 1; i <= Math.min(maxVisible, totalPages); i++) {
                pages.push(i);
            }
        } else if (currentPage > totalPages - 3) {
            for (let i = totalPages - 4; i <= totalPages; i++) {
                if (i > 0) pages.push(i);
            }
        } else {
            for (let i = start; i <= end; i++) {
                pages.push(i);
            }
        }

        return pages;
    };

    const visiblePages = getVisiblePages();

    return (
        <div className="grid grid-cols-1 border border-gray-300 rounded-md gap-2">
            {loading ? (
                <div className="p-4">
                    <GeneralLoader />
                </div>
            ) : (
                <>
                    <Table className="min-w-full">
                        <TableCaption>{caption}</TableCaption>
                        <TableHeader>
                            <TableRow>
                                {columns.map((item, index) => (
                                    <TableHead
                                        key={index}
                                        className="w-24"
                                        id={formatTestId("table_head", `${item}`)}
                                        data-testid={formatTestId("table_head", `${item}`)}
                                    >
                                        {item}
                                    </TableHead>
                                ))}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {currentData.map((row, rowIndex) => {
                                return (
                                    <TableRow
                                        key={rowIndex}
                                        id={formatTestId("table_body", `${row.grupos}_${row.id}`)}
                                        data-testid={formatTestId("table_body", `${row.grupos}_${row.id}`)}
                                    >
                                        {columns.map((col, colIndex) => (
                                            <TableCell
                                                key={colIndex}
                                                data-testid={`table_cell_${row.grupos}_${col}`}
                                                id={`table_cell_${row.grupos}_${col}`}
                                            >
                                                {row[col] !== null && row[col] !== undefined ? row[col] : "0"}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                    <Pagination className="mb-2">
                        <PaginationContent>
                            <PaginationItem>
                                <PaginationPrevious
                                    href="#"
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    id={`pagination_previous_${currentPage}`}
                                    data-testid={`pagination_previous_${currentPage}`}
                                />
                            </PaginationItem>
                            {visiblePages[0] > 1 && (
                                <>
                                    <PaginationItem>
                                        <PaginationLink
                                            href="#"
                                            onClick={() => handlePageChange(1)}
                                            id={`pagination_first_${currentPage}`}
                                            data-testid={`pagination_first_${currentPage}`}
                                        >
                                            1
                                        </PaginationLink>
                                    </PaginationItem>
                                    {visiblePages[0] > 2 && <PaginationEllipsis />}
                                </>
                            )}
                            {visiblePages.map((page) => (
                                <PaginationItem key={page}>
                                    <PaginationLink
                                        href="#"
                                        onClick={() => handlePageChange(page)}
                                        isActive={page === currentPage}
                                        id={`pagination_${page}`}
                                        data-testid={`pagination_${page}`}
                                    >
                                        {page}
                                    </PaginationLink>
                                </PaginationItem>
                            ))}
                            {visiblePages[visiblePages.length - 1] < totalPages && (
                                <>
                                    {visiblePages[visiblePages.length - 1] < totalPages - 1 && <PaginationEllipsis />}
                                    <PaginationItem>
                                        <PaginationLink
                                            href="#"
                                            onClick={() => handlePageChange(totalPages)}
                                            id={`pagination_last_${currentPage}`}
                                            data-testid={`pagination_last_${currentPage}`}
                                        >
                                            {totalPages}
                                        </PaginationLink>
                                    </PaginationItem>
                                </>
                            )}
                            <PaginationItem>
                                <PaginationNext
                                    href="#"
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage === totalPages}
                                    id={`pagination_next_${currentPage}`}
                                    data-testid={`pagination_next_${currentPage}`}
                                />
                            </PaginationItem>
                        </PaginationContent>
                    </Pagination>
                </>
            )}
        </div>
    );
};

TableContainer.propTypes = {
    dataTable: PropTypes.array,
    columns: PropTypes.array,
    rowsPerPage: PropTypes.number,
    loading: PropTypes.bool,
};
