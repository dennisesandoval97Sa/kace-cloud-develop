import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { searchEntityByFields, PER_FIELD_SEARCH_LIMIT } from "@/hooks/searchEntityByFields";

export { PER_FIELD_SEARCH_LIMIT };

/**
 * React hook wrapping {@link searchEntityByFields}: maps rows to `{ value, label }`
 * options and surfaces an error toast only when nothing could be shown (a partial
 * failure that still yields results degrades silently rather than blocking the user).
 *
 * @param {{
 *   selectConfig: object | null,
 *   getLabel: (item: object) => string,
 *   pageSize: number,
 * }} params
 * @returns {(searchQuery: string) => Promise<Array<{ value: unknown, label: string }>>}
 */
export const useBuilderEntitySearch = ({ selectConfig, getLabel, pageSize }) => {
    const { t } = useTranslation();

    return useCallback(
        async (searchQuery) => {
            const { items, anyFieldFailed } = await searchEntityByFields({
                selectConfig,
                query: searchQuery,
                pageSize,
            });

            if (anyFieldFailed && items.length === 0) {
                toast.error(t("actions.querybuilder.searchError"));
                return [];
            }

            return items.map((item) => ({ value: item.id, label: getLabel(item) }));
        },
        [selectConfig, getLabel, pageSize, t],
    );
};
