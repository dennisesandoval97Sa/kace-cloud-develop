import { t } from "i18next";
import { handleState, handleStateTimer } from "@/utils/main";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { FILTER_TRANSFORMATIONS } from "../constants/boardsTable.constants";

export const normalizeBoardRow = (item) => ({
    ...item,
    access_users: (item.access_users_data ?? []).map((user) =>
        user.is_creator ? { ...user, nombre: `${user.nombre} ${t("boards.list.creatorTag")}` } : user,
    ),
    access_groups: item.access_groups_data ?? [],
});

export const processData = async (data) => {
    if (!Array.isArray(data)) return [];

    return handleStateTimer(handleState(data.map(normalizeBoardRow)));
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
