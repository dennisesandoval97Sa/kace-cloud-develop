import { FILTER_BUILDER } from "@kace_v2/shared/constants/filter-builder.constants";
import React from "react";
import { BOARDS_ROWS } from "@kace_v2/features/boards/constants/boards.constants";
import { SQL } from "@kace_v2/shared/constants/sql.constants";
import { collectJoinData } from "@kace_v2/features/boards/utils/relations.util";

export const parseRelationRows = (rows) => {
    return rows.map((row) => {
        const { entities, join_types, on } = collectJoinData(row);
        return {
            id: row.id,
            related_entity: entities.length && (
                <div className="flex flex-col gap-1">
                    {entities.map((entity, index) => (
                        <span key={index} className="font-medium">
                            {entity}
                        </span>
                    ))}
                </div>
            ),
            join_type: join_types.length && (
                <div className="flex flex-col gap-1">
                    {join_types.map((entity, index) => (
                        <span key={index} className="font-medium">
                            {entity}
                        </span>
                    ))}
                </div>
            ),
            on: on.length > 0 && (
                <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    {on.map((filter, index) => (
                        <span key={index}>
                            <span className="font-medium">{filter.left}</span>{" "}
                            <span>{FILTER_BUILDER.OPERATORS[filter.operator]}</span>{" "}
                            <span className="font-semibold">{filter.right}</span>
                            <span className="font-semibold text-foreground"> {filter.type.toUpperCase()} </span>
                        </span>
                    ))}
                </div>
            ),
        };
    });
};

export const parseColumnRows = (rows) => {
    return rows.map((row) => ({
        id: row.id,
        type: BOARDS_ROWS.TYPES[row.type] || null,
        field:
            row.function === SQL.CONCAT_FUNCTIONS.CONCAT
                ? `CONCAT(${(row.concat_sources ?? []).map((s) => `${s.entity}.${s.field}`).join(", ")})`
                : row.field || null,
        alias: row.alias,
        is_filterable: (
            <p
                className="py-1 px-2 rounded-full text-center"
                style={{
                    backgroundColor: row.is_filterable ? "#2A9D9070" : "#E76E5080",
                    color: row.is_filterable ? "#2A9D90" : "#E76E50",
                }}
            >
                {row.is_filterable ? "SI" : "NO"}
            </p>
        ),
        is_status_column: (
            <p
                className="py-1 px-2 rounded-full text-center"
                style={{
                    backgroundColor: row.is_status_column ? "#2A9D9070" : "#E76E5080",
                    color: row.is_status_column ? "#2A9D90" : "#E76E50",
                }}
            >
                {row.is_status_column ? "SI" : "NO"}
            </p>
        ),
        visible: (
            <p
                className="py-1 px-2 rounded-full text-center"
                style={{
                    backgroundColor: row.visible !== false ? "#2A9D9070" : "#E76E5080",
                    color: row.visible !== false ? "#2A9D90" : "#E76E50",
                }}
            >
                {row.visible !== false ? "SI" : "NO"}
            </p>
        ),
        data_type: row.data_type,
        format: row.format,
        function: row.function || "",
        group_by: (
            <p
                className="py-1 px-2 rounded-full text-center"
                style={{
                    backgroundColor: row.group_by ? "#2A9D9070" : "#E76E5080",
                    color: row.group_by ? "#2A9D90" : "#E76E50",
                }}
            >
                {row.group_by ? "SI" : "NO"}
            </p>
        ),
    }));
};

export const parseHavingRows = (rows) => {
    return rows.map((row) => ({
        id: row.id,
        function: row.function || "",
        field: row.field || "",
        operator: row.operator || "",
        value: row.value || "",
    }));
};

export const parseOptionsRows = (rows = [], options) => {
    if (!rows || !Array.isArray(rows)) return [];
    return rows?.map((row) => {
        const ref_option = options?.[row.type]?.find((option) => option.value === row.ref_id);
        const ref_name = ref_option?.label ?? "";
        return {
            id: row.id,
            type: row.type,
            ref_id: ref_name,
            label: row.label,
            requires_confirmation: (
                <p
                    className="py-1 px-2 rounded-full text-center"
                    style={{
                        backgroundColor: row.requires_confirmation ? "#2A9D9070" : "#E76E5080",
                        color: row.requires_confirmation ? "#2A9D90" : "#E76E50",
                    }}
                >
                    {row.requires_confirmation ? "SI" : "NO"}
                </p>
            ),
        };
    });
};
