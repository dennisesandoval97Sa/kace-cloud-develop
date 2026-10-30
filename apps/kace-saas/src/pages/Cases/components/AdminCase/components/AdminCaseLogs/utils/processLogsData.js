import { handleState, handleStateTimer, handleFullName } from "@/utils/main";
import { FILTER_TRANSFORMATIONS } from "../constants";
import { SPECIAL_FIELDS } from "@/services/createSchemaFilter";
import { genericSearchService } from "@/services/genericSearchService";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const processData = async (data) => {
    const dataUsers = data?.map(row => row.initiated_by_user);
    const users = dataUsers?.length ? await genericSearchService(
        `${URL_AND_KEYS.users.url}/search`,
        [
            {
                field: "id",
                operator: "in",
                value: dataUsers?.join(", ") ?? "",
                type: "OR",
            },
        ]
    ) : [];

    const processedUsers = handleFullName(users.data);

    const normalizedData = data?.data ?? data;
    return handleStateTimer(
            handleState(normalizedData)
        , ['occurred_at']).map(row => ({
            ...row,
            initiated_by_user: processedUsers.find(user => user.id === row.initiated_by_user)?.nombres
        })
        );
};

export const processColumns = (defaultFilters) => ({
    ...defaultFilters,
    ...FILTER_TRANSFORMATIONS,
});

export const processFilters = (defaultFilters) => [
    ...defaultFilters,
    {
        column_name: "event_name",
        field: SPECIAL_FIELDS.string,
    },
    {
        column_name: "aggregate_id",
        field: SPECIAL_FIELDS.string,
    },
    {
        column_name: "initiated_by_user",
        field: SPECIAL_FIELDS.search_users,
    },
    {
        column_name: "occurred_at",
        field: SPECIAL_FIELDS.datetime,
    },
];
