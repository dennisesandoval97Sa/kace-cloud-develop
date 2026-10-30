import PropTypes from "prop-types"

import DataTable from "@/componentsV2/core/DataTable"
import useDataTable from "@/hooks/useDataTable"
import { dataTableConfig } from "../constants"
import {
    processColumns,
    processFilters,
    processData
} from "../utils/processLogsData"
import { useMemo, useState } from "react"
import EventDetailsModal from "./EventDetailsModal"
import { useTranslation } from "react-i18next"

const DetailedDatatable = ({caseId}) => {
    const { t } = useTranslation();
    const [eventsData, setEventsData] = useState([]);
    const [showDetailsModal, setShowDetails] = useState(false);

    const { renderData, query, filters, pagination, columnSelector } =
        useDataTable({
            actions: [
                {
                    name: t("event_logs.viewDetails"),
                    label: t("event_logs.viewDetails"),
                    action: (event, sds) => {
                        setShowDetails(event);
                    },
                },
            ],
            dataTableConfig: {
                ...dataTableConfig,
                url: `${dataTableConfig.url}/${caseId}`
            },
            processFilters,
            processColumns,
            processData: async (data) => {
                if(data) setEventsData(data, t);

                return processData(data, dataTableConfig.key);
            }
        });

    const handleCloseDetailsModal = () => {
        setShowDetails(false);
    }

    const eventDetails = useMemo(() => eventsData.find(evt => evt.id === showDetailsModal), [showDetailsModal]);

    return (
        <>
            <EventDetailsModal isOpen={showDetailsModal} onClose={handleCloseDetailsModal} eventData={eventDetails} />
            <DataTable
                renderData={renderData}
                query={query}
                filters={filters}
                pagination={pagination}
                columnSelector={columnSelector}
            />
        </>
    )
}

DetailedDatatable.propTypes = {
    caseId: PropTypes.string
}

export default DetailedDatatable
