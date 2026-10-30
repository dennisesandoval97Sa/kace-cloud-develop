import { handleState, handleStateTimer } from "../../../utils/main";
import { SPECIAL_FIELDS } from "../../../services/createSchemaFilter";
import { FILTER_TRANSFORMATIONS } from "../data/constants";
import { formatNotificationCalendarFields } from "../../../utils/notificationDates";

export const processData = async (data) => {
    const normalizedData = data?.data ?? data;
    const processedData = handleStateTimer(handleState(normalizedData));
    return formatNotificationCalendarFields(processedData, normalizedData, ["fecha_inicio", "fecha_fin"]);
};

export const processColumns = (defaultFilters) => ({
    ...defaultFilters,
    ...FILTER_TRANSFORMATIONS,
});

export const processFilters = (defaultFilters) => [
    ...defaultFilters,
    {
        column_name: "is_active",
        field: SPECIAL_FIELDS.switch_state,
    },
];
