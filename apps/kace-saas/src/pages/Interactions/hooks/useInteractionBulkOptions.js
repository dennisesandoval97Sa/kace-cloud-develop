import { useMemo } from "react";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { createSystemInboxWorkspaceExclusionFilter, excludeSystemInboxWorkspaces } from "@/utils/systemInboxWorkspace";

const ACTIVE_NOT_DELETED_FILTER = [
    {
        field: "is_active",
        operator: "eq",
        value: "1",
        type: "AND",
    },
    {
        field: "deleted_at",
        operator: "null",
        value: "null",
        type: "AND",
    },
];

const getRows = (data) => (Array.isArray(data?.data) ? data.data : []);

const getWorkspaceLabel = (workspace) =>
    workspace?.description || workspace?.descripcion || workspace?.nombre || workspace?.name || workspace?.id || "";

const getLiteralValue = (literal) =>
    literal?.nombre || literal?.name || literal?.descripcion || literal?.description || literal?.id || "";

const getLiteralLabel = (literal) =>
    literal?.descripcion || literal?.description || literal?.nombre || literal?.name || literal?.id || "";

const useInteractionBulkOptions = () => {
    const { data: workspaceOptions = [], isLoading: isLoadingWorkspaces } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.workspaces.url}/search`,
        keyQuery: `${URL_AND_KEYS.workspaces.key}-interactions-bulk`,
        filter: [
            {
                field: "is_active",
                operator: "eq",
                value: "true",
                type: "AND",
            },
            createSystemInboxWorkspaceExclusionFilter(),
        ],
        select: (data) =>
            excludeSystemInboxWorkspaces(getRows(data)).map((workspace) => ({
                label: String(getWorkspaceLabel(workspace)),
                value: String(workspace.id),
            })),
    });

    const { data: modelRows = [], isLoading: isLoadingLiteralModel } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.literals.url}/search`,
        keyQuery: "interactions-bulk-literal-model",
        useDefault: false,
        filter: [
            {
                field: "tipo_literal",
                operator: "null",
                value: "null",
                type: "AND",
            },
            {
                field: "nombre",
                operator: "eq",
                value: "interactions",
                type: "AND",
            },
            ...ACTIVE_NOT_DELETED_FILTER,
        ],
        select: getRows,
    });

    const modelId = modelRows[0]?.id;

    const { data: fieldRows = [], isLoading: isLoadingLiteralField } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.literals.url}/search`,
        keyQuery: "interactions-bulk-literal-field",
        useDefault: false,
        enabled: Boolean(modelId),
        filter: [
            {
                field: "tipo_literal",
                operator: "eq",
                value: modelId,
                type: "AND",
            },
            {
                field: "nombre",
                operator: "eq",
                value: "closed_observation",
                type: "AND",
            },
            ...ACTIVE_NOT_DELETED_FILTER,
        ],
        select: getRows,
    });

    const fieldId = fieldRows[0]?.id;

    const { data: motiveRows = [], isLoading: isLoadingMotiveOptions } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.literals.url}/search`,
        keyQuery: "interactions-bulk-literal-options",
        useDefault: false,
        enabled: Boolean(fieldId),
        filter: [
            {
                field: "tipo_literal",
                operator: "eq",
                value: fieldId,
                type: "AND",
            },
            ...ACTIVE_NOT_DELETED_FILTER,
        ],
        select: getRows,
    });

    const motiveOptions = useMemo(
        () =>
            motiveRows
                .map((literal) => ({
                    label: String(getLiteralLabel(literal)),
                    value: String(getLiteralValue(literal)),
                }))
                .filter((option) => option.label && option.value),
        [motiveRows],
    );

    return {
        workspaceOptions,
        motiveOptions,
        isLoadingWorkspaces,
        isLoadingMotiveOptions: isLoadingLiteralModel || isLoadingLiteralField || isLoadingMotiveOptions,
    };
};

export default useInteractionBulkOptions;
