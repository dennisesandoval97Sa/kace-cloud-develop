import { useState } from "react";
import useDataTable from "@/hooks/useDataTable";
import DataTable from "@/componentsV2/core/DataTable";
import { getBatchStatusData } from "@/utils/src/utils/FormatData";
import MassiveExecutionActionsState from "./MassiveExecutionActionsState";
import { dataTableConfig } from "../data/constants";
import { processColumns, processData, processFilters } from "../utils/datatableProcess";

const MassiveExecutionTableContainer = () => {
    const [batchStatusData, setBatchStatusData] = useState([]);

    const processTableData = (data) => {
        setBatchStatusData(getBatchStatusData(data));
        return processData(data);
    };

    const { renderData, query, filters, pagination, columnSelector } =
        useDataTable({
            dataTableConfig,
            actions: [],
            processFilters,
            processColumns,
            processData: processTableData,
            userQueryView: false,
        });

    return (
        <div className="w-full flex flex-col gap-4">
            <div className="w-full flex flex-col gap-4 lg:flex-row justify-between items-center lg:gap-10">
                {batchStatusData.map(({ id, title, icon, number, color }) => (
                    <MassiveExecutionActionsState
                        key={id}
                        title={title}
                        icon={icon}
                        number={number}
                        color={color}
                    />
                ))}
            </div>
            <DataTable
                renderData={renderData}
                query={query}
                filters={filters}
                pagination={pagination}
                columnSelector={columnSelector}
            />
        </div>
    );
};

export default MassiveExecutionTableContainer;
