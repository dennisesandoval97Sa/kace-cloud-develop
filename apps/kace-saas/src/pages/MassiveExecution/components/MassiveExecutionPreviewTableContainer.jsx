import { createColumns, GeneralLoader } from "@kace/ui-shared";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import useMassiveExecutionCasesTable from "../hooks/useMassiveExecutionCasesTable";
import useMassiveExecutionClientsTable from "../hooks/useMassiveExecutionClientsTable";
import { DataTableContainer } from "@/components/ui-shared/src/components/table-component/DataTableContainer";

const MassiveExecutionPreviewTableContainer = () => {
    const { t } = useTranslation();

    const {
        dataTable: caseDataTable,
        headers: casesHeaders,
        isLoadingTable: isCaseLoadingTable,
    } = useMassiveExecutionCasesTable();

    const {
        dataTable: usersDataTable,
        headers: usersHeaders,
        isLoadingTable: isUsersLoadingTable,
    } = useMassiveExecutionClientsTable();

    const isLoading = useMemo(
        () => isCaseLoadingTable || isUsersLoadingTable,
        [isCaseLoadingTable, isUsersLoadingTable],
    );

    const currentHeaders = useMemo(() => {
        if (caseDataTable.length > 0) {
            return casesHeaders.map((column) => ({
                accessorKey: column.column_name,
                header: t(`gridMain.columns.${column.label}`),
                value: column.data_type,
            }));
        }

        if (usersDataTable.length > 0) {
            return usersHeaders.map((column) => ({
                accessorKey: column.column_name,
                header: t(`gridMain.columns.${column.label}`),
                value: column.data_type,
            }));
        }

        return [];
    }, [caseDataTable, casesHeaders, usersDataTable, usersHeaders]);

    const currentData = useMemo(() => {
        if (caseDataTable.length > 0) {
            return caseDataTable;
        }

        if (usersDataTable.length > 0) {
            return usersDataTable;
        }

        return [];
    }, [caseDataTable, usersDataTable]);

    const columnsData = useMemo(() => createColumns(currentHeaders, false, [], []), [currentHeaders]);

    return (
        <div className="w-full">
            {isLoading ? (
                <GeneralLoader />
            ) : (
                currentData.length > 0 && (
                    <DataTableContainer
                        columns={columnsData}
                        dataTable={currentData}
                        isPagination
                        isLoadingTable={isLoading}
                        showFilterGeneric={false}
                        showColumnsButton={false}
                        showUpdateButton={false}
                        getRowCanExpand={(row) => row.original.children?.length > 0}
                    />
                )
            )}
        </div>
    );
};

export default MassiveExecutionPreviewTableContainer;
