import React from "react";
import PropTypes from "prop-types";
import TableRow from "@kace_v2/shared/ui/atoms/TableRow";
import TableCell from "@kace_v2/shared/ui/atoms/TableCell";
import Loader from "@kace_v2/shared/ui/molecules/Loader";
import DataTableError from "@kace_v2/shared/ui/molecules/DataTableError";
import { useTranslation } from "react-i18next";
import { TableBody } from "@kace/ui-shared";

const DataTableBody = ({
    className,
    columns = [],
    rows = [],
    isLoading = false,
    isError = false,
    handlerError = () => {},
    children,
}) => {
    const { t } = useTranslation();
    let content;

    if (isLoading) {
        content = (
            <TableRow>
                <TableCell className="h-24 text-center" colSpan={columns.length}>
                    <Loader />
                </TableCell>
            </TableRow>
        );
    } else if (isError) {
        content = (
            <TableRow className="h-24 text-center">
                <TableCell colSpan={columns.length}>
                    <DataTableError handler={handlerError} />
                </TableCell>
            </TableRow>
        );
    } else if (!rows.length) {
        content = (
            <TableRow>
                <TableCell className="h-24 text-center" colSpan={columns.length}>
                    <p className="font-semibold text-muted">{t("gridMain.text.noResults")}</p>
                </TableCell>
            </TableRow>
        );
    } else {
        content = children;
    }

    return <TableBody className={className}>{content}</TableBody>;
};

DataTableBody.propTypes = {
    className: PropTypes.string,
    columns: PropTypes.arrayOf(
        PropTypes.shape({
            key: PropTypes.string.isRequired,
            header: PropTypes.string.isRequired,
            width: PropTypes.string,
        }),
    ),
    rows: PropTypes.array,
    isLoading: PropTypes.bool,
    isError: PropTypes.bool,
    handlerError: PropTypes.func,
    children: PropTypes.node,
};

export default DataTableBody;
