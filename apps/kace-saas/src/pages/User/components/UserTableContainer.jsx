import PropTypes from "prop-types";
import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import useDataTable from "@/hooks/useDataTable";
import DataTable from "@/componentsV2/core/DataTable";
import { dataTableConfig } from "../data/constants";
import { processColumns, processData, processFilters, processSchema } from "../utils/datatableProcess";
import { apiService } from "@/utils/main";
import { parseResponseApi } from "@kace_v2/shared/utils/parse-response-api.util";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const ROLES_LOOKUP_PAGE_SIZE = 25;

export const UserTableContainer = ({ arrayAction = [] }) => {
    const { data: allRolesData } = useQuery({
        queryKey: ["allRolesLookup"],
        queryFn: async () => {
            const data = await apiService.post(`${URL_AND_KEYS.roles.url}/search`, {
                filter: [],
                limit: ROLES_LOOKUP_PAGE_SIZE,
                offset: 0,
            });
            return parseResponseApi(data);
        },
        staleTime: 5 * 60 * 1000,
    });

    const rolesMap = useMemo(() => {
        const map = {};
        (allRolesData?.data || []).forEach((r) => {
            map[r.id] = r.descripcion;
        });
        return map;
    }, [allRolesData]);

    const getRowEnhancer = useCallback((row) => ({ rol_nombre: rolesMap[row.rol_id] || "" }), [rolesMap]);

    const { renderData, query, filters, pagination, columnSelector } = useDataTable({
        dataTableConfig,
        actions: arrayAction,
        processFilters,
        processColumns,
        processData,
        processSchema,
        getRowEnhancer,
    });

    return (
        <DataTable
            renderData={renderData}
            query={query}
            filters={filters}
            pagination={pagination}
            columnSelector={columnSelector}
        />
    );
};

UserTableContainer.propTypes = {
    arrayAction: PropTypes.array,
};
