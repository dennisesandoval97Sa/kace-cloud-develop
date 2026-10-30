import { mergeAndLimitResults } from "@/pages/Actions/utils/mergeSearchResults";
import { escapeLikePattern } from "@/utils/likePattern";
import { genericSearch } from "@/services/genericSearch";

/**
 * Per-field cap for multi-field searches. Deliberately larger than the visible
 * page size so that, when the query matches different users on each name
 * column, the post-merge `slice` still has enough candidates to fill the page
 * instead of biasing the result towards the first column.
 */
export const PER_FIELD_SEARCH_LIMIT = 50;

/**
 * Runs the rule-builder entity search and returns the merged, de-duplicated
 * rows. Pure (no React, no toast) so it can be unit tested without a component
 * render.
 *
 * `search-authorization` rejects any OR filter on endpoints that declare a
 * mandatory base filter (e.g. `users.search`) for restricted roles, so a
 * multi-field search cannot be expressed as a single `groupType: "OR"`
 * request. Instead each configured field is searched independently (AND-only)
 * and the results are merged client-side using `mergeAndLimitResults`
 * (round-robin, dedupe by id, post-merge slice).
 *
 * @param {{
 *   selectConfig: { url: string, searchFields?: string[], labelField?: string, baseFilter?: Array<object> } | null,
 *   query: string,
 *   pageSize: number,
 *   search?: (url: string, filter: Array<object>, pagination: object) => Promise<{ data?: Array<object> }>,
 * }} params
 * @returns {Promise<{ items: Array<object>, anyFieldFailed: boolean }>}
 */
export const searchEntityByFields = async ({ selectConfig, query, pageSize, search = genericSearch }) => {
    if (!selectConfig || !selectConfig.url) return { items: [], anyFieldFailed: false };

    const trimmedQuery = String(query ?? "").trim();
    if (!trimmedQuery) return { items: [], anyFieldFailed: false };

    const fields = selectConfig.searchFields ?? [selectConfig.labelField ?? "id"];
    const baseFilter = selectConfig.baseFilter ?? [];
    const pagination = { limit: PER_FIELD_SEARCH_LIMIT, offset: 0 };

    const escapedQuery = escapeLikePattern(trimmedQuery);

    const settled = await Promise.allSettled(
        fields.map((searchField) =>
            search(
                `${selectConfig.url}/search`,
                [...baseFilter, { field: searchField, operator: "ilike", value: escapedQuery, type: "AND" }],
                pagination,
            ),
        ),
    );

    const fulfilled = settled.filter((result) => result.status === "fulfilled");

    return {
        items: mergeAndLimitResults(
            fulfilled.map((result) => result.value),
            pageSize,
        ),
        anyFieldFailed: fulfilled.length < settled.length,
    };
};
