import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import useAns from "@kace_v2/features/boards/hooks/useAns.hook";
import {
    QUICK_ANS_FILTER_DEFAULT_COLORS,
    QUICK_ANS_FILTER_DEFAULT_LABELS,
} from "@kace_v2/features/boards/constants/boards.constants";

const ANS_POSITIONS = [1, 2, 3];

const useQuickAnsFilter = ({ boardConfig, criteria, handleFilter, clearFilters }) => {
    const { t } = useTranslation();

    const hasAnsColumn = useMemo(
        () => Boolean(boardConfig?.columns?.some((column) => column.is_ans)),
        [boardConfig?.columns],
    );

    const { data: ansItems } = useAns(hasAnsColumn);

    const resolvedAnsConfig = useMemo(() => {
        const config = boardConfig?.quick_ans_filter;
        if (!config?.enabled) return null;
        return config;
    }, [boardConfig?.quick_ans_filter]);

    const defaultLabelByPosition = useCallback(
        (position) =>
            t(`boards.form.quickAnsFilter.labels.defaultLabel${position}`, {
                defaultValue: QUICK_ANS_FILTER_DEFAULT_LABELS[position],
            }),
        [t],
    );

    const quickAnsFilter = useMemo(() => {
        const config = resolvedAnsConfig;
        if (!config) return null;
        const firstAnsColumn = boardConfig?.columns?.find((column) => column?.is_ans);
        const alias = config.ans_column_alias || firstAnsColumn?.alias || firstAnsColumn?.field;
        if (!alias) return null;
        const ansColumn = boardConfig?.columns?.find(
            (column) => column?.is_ans && (column?.alias || column?.field) === alias,
        );
        if (!ansColumn) return null;
        const labels = config.labels || {};
        const useDefaultColors = config.use_default_colors !== false;
        const firstAns = ansItems?.[0];
        const colors = useDefaultColors
            ? {
                  1: firstAns?.color_ans_inicial ?? QUICK_ANS_FILTER_DEFAULT_COLORS[1],
                  2: firstAns?.color_ans_intermedio ?? QUICK_ANS_FILTER_DEFAULT_COLORS[2],
                  3: firstAns?.color_ans_final ?? QUICK_ANS_FILTER_DEFAULT_COLORS[3],
              }
            : {
                  1: config.colors?.[1] || QUICK_ANS_FILTER_DEFAULT_COLORS[1],
                  2: config.colors?.[2] || QUICK_ANS_FILTER_DEFAULT_COLORS[2],
                  3: config.colors?.[3] || QUICK_ANS_FILTER_DEFAULT_COLORS[3],
              };
        return {
            field: ansColumn.alias || ansColumn.field,
            entity: ansColumn.entity,
            buttons: ANS_POSITIONS.map((value) => ({
                value,
                label: (labels[value] && String(labels[value]).trim()) || defaultLabelByPosition(value),
                color: colors[value],
            })),
        };
    }, [resolvedAnsConfig, boardConfig?.columns, ansItems, defaultLabelByPosition]);

    const activeAnsValue = useMemo(() => {
        if (!quickAnsFilter || !Array.isArray(criteria?.filter)) return null;
        const found = criteria.filter.find((f) => f.field === quickAnsFilter.field && f.operator === "eq");
        if (!found) return null;
        const parsed = Number(found.value);
        return Number.isFinite(parsed) ? parsed : null;
    }, [quickAnsFilter, criteria?.filter]);

    const applyQuickAnsFilter = useCallback(
        (value) => {
            if (!quickAnsFilter) return;
            const targetValue = Number(value);
            const currentFilters = Array.isArray(criteria?.filter) ? criteria.filter : [];
            const filtersWithoutAns = currentFilters.filter(
                (f) => !(f.field === quickAnsFilter.field && f.operator === "eq"),
            );

            if (activeAnsValue === targetValue) {
                filtersWithoutAns.length > 0 ? handleFilter(filtersWithoutAns) : clearFilters();
                return;
            }

            handleFilter([
                ...filtersWithoutAns,
                {
                    field: quickAnsFilter.field,
                    operator: "eq",
                    type: "AND",
                    value: targetValue,
                    ...(quickAnsFilter.entity && { entity: quickAnsFilter.entity }),
                },
            ]);
        },
        [quickAnsFilter, handleFilter, clearFilters, activeAnsValue, criteria?.filter],
    );

    const handleModalFilter = useCallback(
        (newFilters, formValues) => {
            const currentFilters = Array.isArray(criteria?.filter) ? criteria.filter : [];
            const ansFilters = quickAnsFilter
                ? currentFilters.filter((f) => f.field === quickAnsFilter.field && f.operator === "eq")
                : [];
            handleFilter([...ansFilters, ...newFilters], formValues);
        },
        [criteria?.filter, quickAnsFilter, handleFilter],
    );

    return {
        ansItems,
        quickAnsFilter,
        activeAnsValue,
        applyQuickAnsFilter,
        handleModalFilter,
    };
};

export default useQuickAnsFilter;
