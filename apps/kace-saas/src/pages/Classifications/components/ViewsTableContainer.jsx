import { createColumns } from "@kace/ui-shared";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import useRelationshipAction from "../hooks/useRelationshipAction";
import useRelationshipTable from "../hooks/useRelationshipTable";
import { useEffect, useMemo, useState } from "react";
import { DataTableContainer } from "../../../components/ui-shared/src/components/table-component/DataTableContainer";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";

export const ViewsTableContainer = ({ id, pendingData = [], onRemovePending, isSaving = false }) => {
    const { t } = useTranslation();
    const [currentHeaders, setCurrentHeaders] = useState([]);
    const { headers, dataTable, isFetching, isLoadingTable, refetch, tableError } = useRelationshipTable(id);
    const { handleDeleteGroup, deleteGroupLoading } = useRelationshipAction(id);
    const dataTableData = useMemo(
        () => [...pendingData, ...(dataTable?.data ?? [])].filter((group) => !!group.group_id),
        [pendingData, dataTable?.data],
    );

    // A pending group has no relationship in the database yet: it is discarded from the draft.
    const handleDelete = (groupId) =>
        pendingData.some((group) => group.group_id === groupId) ? onRemovePending(groupId) : handleDeleteGroup(groupId);

    const handleCurrentHeaders = (headers) => {
        const keyColumns = headers.map((column) => {
            return {
                accessorKey: column.accessorKey,
                header: t(`gridMain.columns.${column.label}`),
                value: column.key,
            };
        });
        setCurrentHeaders(keyColumns);
    };

    const columnsData = useMemo(
        () =>
            createColumns(
                currentHeaders,
                1,
                [],
                [
                    {
                        name: `${t("app.forms.delete")}`,
                        action: handleDelete,
                        customizable: false,
                    },
                ],
                false,
                "group",
            ),
        [currentHeaders, t, handleDelete],
    );
    useEffect(() => {
        handleCurrentHeaders(headers);
    }, [headers]);

    return (
        <DataTableContainer
            columns={columnsData}
            isPagination
            isLoadingHeaders={isLoadingTable}
            view={URL_AND_KEYS.classification}
            isLoadingTable={isLoadingTable || deleteGroupLoading || isSaving}
            dataTable={dataTableData}
            isFetching={isFetching}
            refresh={refetch}
            errorData={tableError}
            showFilterGeneric={false}
            showColumnsButton={false}
            showUpdateButton={false}
        />
    );
};

ViewsTableContainer.propTypes = {
    id: PropTypes.string,
    pendingData: PropTypes.array,
    onRemovePending: PropTypes.func.isRequired,
    isSaving: PropTypes.bool,
};
