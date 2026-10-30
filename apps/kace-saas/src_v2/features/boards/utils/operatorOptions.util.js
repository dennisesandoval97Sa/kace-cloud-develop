import { FILTER_BUILDER } from "@kace_v2/shared/constants/filter-builder.constants";

export const operatorOptions = () => {
    return Object.entries(FILTER_BUILDER.OPERATORS).map(([value, label]) => ({
        label,
        value,
    }));
};
