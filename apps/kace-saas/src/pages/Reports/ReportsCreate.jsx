import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import useGeneralMutation from "@/hooks/useGeneralMutation";
import { genericView } from "@/services/genericView";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import { REPORTS_SERVICE } from "@/utils/URL";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import ReportsForm from "./components/ReportsForm";
import useUserInformation from "@/hooks/useUserInformation";
import { INITIAL_VALUES_REPORTS } from "./data/constants";
import { formatDate } from "@/utils/src/utils/dateUtils";

/**
 * Formats report name with time suffix using tenant timezone.
 * This ensures the timestamp shown to users matches their expected local time.
 *
 * @param {Object} data - Report data with created_at field
 * @returns {Object} Report data with formatted name including time suffix
 */
const formatReportNameWithTime = (data) => {
    if (!data?.created_at) {
        return data;
    }

    try {
        // Use tenant timezone for the time suffix to match user expectations
        const timeString = formatDate(data.created_at, "HHmmss");

        return {
            ...data,
            name: `${data.name}_${timeString}`,
        };
    } catch {
        const createdAt = new Date(data.created_at);
        const hours = String(createdAt.getUTCHours()).padStart(2, "0");
        const minutes = String(createdAt.getUTCMinutes()).padStart(2, "0");
        const seconds = String(createdAt.getUTCSeconds()).padStart(2, "0");
        const timeString = `${hours}${minutes}${seconds}`;

        return {
            ...data,
            name: `${data.name}_${timeString}`,
        };
    }
};

export const ReportsCreate = () => {
    const { id } = useParams();
    const { user } = useUserInformation();

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: "report_executions",
        path: "/reports",
    });

    const { data, isLoading } = useQuery({
        queryKey: ["report_executions", id],
        queryFn: async () => genericView(`${REPORTS_SERVICE}/${id}`),
        enabled: !!id,
    });

    const formattedData = useMemo(() => {
        if (!data) return INITIAL_VALUES_REPORTS;
        return formatReportNameWithTime(data);
    }, [data]);

    const handleSubmit = (values, setFormikErrors, setFormikStatus) => {
        const payload = {
            ...values,
            issuedBy: user?.id || localStorage.getItem("userId") || "",
        };

        const finalData = genericHandleSendInformation({
            values: payload,
            urlService: REPORTS_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
            options: { isCreate: !id, keepId: false, generateId: false },
        });

        if (finalData) {
            mutate(finalData);
        }
    };

    return (
        <DashboardSectionCard>
            <ReportsForm dataHandler={handleSubmit} data={formattedData} isSending={isPending || isLoading} />
        </DashboardSectionCard>
    );
};

export default ReportsCreate;
