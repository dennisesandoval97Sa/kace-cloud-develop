import { BOARDS_DETAILS } from "@kace_v2/features/boards/constants/boards.constants";
import { inferIsStatusColumn } from "@kace_v2/features/boards/utils/boardStatusColumn.util";
import { toOptionalInt } from "@kace_v2/features/boards/utils/toOptionalInt.util";

export const normalizeBoardsData = (data) => {
    if (!data) return BOARDS_DETAILS.INITIAL_VALUES;

    return {
        ...BOARDS_DETAILS.INITIAL_VALUES,
        ...data,
        access_groups: Array.isArray(data.access_groups) ? data.access_groups : [],
        access_users: Array.isArray(data.access_users) ? data.access_users : [],
        columns: Array.isArray(data.columns)
            ? data.columns.map((col) => ({
                  ...col,
                  function: col?.function === "null" || col?.function === null ? null : col?.function,
                  is_status_column: inferIsStatusColumn(col),
              }))
            : [],
        havings: Array.isArray(data.havings) ? data.havings : [],
        orders: Array.isArray(data.orders) ? data.orders : [],
        relations: data.relations === null ? null : Array.isArray(data.relations) ? data.relations : [],
        options: data.options === null ? null : Array.isArray(data.options) ? data.options : [],
        criteria:
            data.criteria && typeof data.criteria === "object" && Array.isArray(data.criteria.items)
                ? { items: data.criteria.items }
                : { items: [] },
        name: data.name ?? "",
        description: data.description ?? "",
        primary_entity: data.primary_entity ?? "",
        icon_class: data.icon_class ?? "",
        onescript_form_id: data.onescript_form_id ?? "",
        filter_onescript_id: data.filter_onescript_id ?? "",
        page_size: toOptionalInt(data.page_size, ""),
        display_order: toOptionalInt(data.display_order, ""),
        is_active: data.is_active ?? true,
        can_view_record: data.can_view_record ?? true,
        can_create_record: data.can_create_record ?? true,
        can_edit_record: data.can_edit_record ?? true,
        can_admin_bulk_actions: data.can_admin_bulk_actions ?? false,
        can_agent_bulk_actions: data.can_agent_bulk_actions ?? false,
        can_admin_delete_record: data.can_admin_delete_record ?? false,
        can_agent_delete_record: data.can_agent_delete_record ?? false,
        quick_ans_filter: {
            enabled: Boolean(data?.quick_ans_filter?.enabled),
            ans_column_alias: data?.quick_ans_filter?.ans_column_alias ?? "",
            labels: {
                1: data?.quick_ans_filter?.labels?.[1] ?? "",
                2: data?.quick_ans_filter?.labels?.[2] ?? "",
                3: data?.quick_ans_filter?.labels?.[3] ?? "",
            },
            use_default_colors: data?.quick_ans_filter?.use_default_colors !== false,
            colors: {
                1: data?.quick_ans_filter?.colors?.[1] ?? "",
                2: data?.quick_ans_filter?.colors?.[2] ?? "",
                3: data?.quick_ans_filter?.colors?.[3] ?? "",
            },
        },
    };
};
