import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { TIME_SLOT_SERVICE } from "@kace/urls";
import { genericView } from "../../../services/genericView";

export const useTimeSlotsData = (id) => {
    const { t } = useTranslation();

    const { data, isLoading } = useQuery({
        queryKey: ["timeSlotsForm", id],
        queryFn: async () => genericView(`${TIME_SLOT_SERVICE}/${id}`),
        enabled: !!id,
    });

    const handleTimeStartChange = (value, endTime, setFieldValue) => {
        if (!!endTime && value > endTime) {
            toast.error(t("timeSlots.alerts.endDate"));
        } else if (!!endTime && value === endTime) {
            toast.error(t("timeSlots.alerts.sameTime"));
        } else {
            setFieldValue("start_time", value);
        }
    };

    const handleTimeEndChange = (value, startTime, setFieldValue) => {
        if (!!startTime && value < startTime) {
            toast.error(t("timeSlots.alerts.startDate"));
        } else if (!!startTime && value === startTime) {
            toast.error(t("timeSlots.alerts.sameTime"));
        } else {
            setFieldValue("end_time", value);
        }
    };

    return {
        data,
        isLoading,
        handleTimeStartChange,
        handleTimeEndChange,
    };
};
