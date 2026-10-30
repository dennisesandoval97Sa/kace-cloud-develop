import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useLocation } from "react-router-dom";
import PropTypes from "prop-types";

const ReferenceCell = ({ row, navigate }) => {
    const location = useLocation();
    const reference = row.original.reference || row.original.consecutivo;
    const id = row.original.id;
    const isAgentView = location.pathname.includes("/agent");
    
    return (
        <button
            type="button"
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const route = isAgentView ? `/agent/update/${id}?action=edit` : `/cases/update/${id}`;
                navigate(route);
            }}
            className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer"
        >
            {reference}
        </button>
    );
};

ReferenceCell.propTypes = {
    row: PropTypes.shape({
        original: PropTypes.shape({
            id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            reference: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            consecutivo: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        }),
    }),
    navigate: PropTypes.func,
};

const useIncludeSubcasesColumns = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();

    const includeSubcasesColumns = useCallback(
        ({ availableColumns }) => {
            if (!availableColumns) return [];

            const parsedColumns = availableColumns.filter(
                (column) => column.id !== "actions" && column.accessorKey !== "reference",
            );

            return [
                {
                    accessorKey: "reference",
                    header: t("gridMain.columns.Consecutivo"),
                    value: "Number",
                    cell: ({ row }) => <ReferenceCell row={row} navigate={navigate} />,
                },
                ...parsedColumns,
            ];
        },
        [navigate, t],
    );

    return { includeSubcasesColumns };
};

export default useIncludeSubcasesColumns;
