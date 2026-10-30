import { TEMPLATES_SERVICE } from "@kace/utils";
import { genericSearchService } from "@/services/genericSearchService";

export const TEMPLATES_ALPHABETICAL_ORDER = {
    field: "plantillas.descripcion",
    direction: "asc",
};

export const STATUS_ACTIVE_FILTER = { field: "status", operator: "eq", value: 1, type: "AND" };
const FETCH_PAGE_SIZE = 100;

export const toTemplateOption = (row) => ({
    id: row.id,
    label: row.descripcion,
    value: row.descripcion,
});

export const uniqueById = (items) => {
    const seen = new Set();
    return items.filter((item) => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
    });
};

export const sortTemplatesAlphabetically = (items = []) =>
    [...items].sort((left, right) =>
        String(left.label ?? "").localeCompare(String(right.label ?? ""), "es", { sensitivity: "base" }),
    );

export const buildTemplateSearchFilters = (searchFilter = "") => {
    const filters = [STATUS_ACTIVE_FILTER];
    const trimmed = searchFilter.trim();
    if (trimmed) {
        filters.push({
            field: "descripcion",
            operator: "ilike",
            value: trimmed,
            type: "AND",
        });
    }
    return filters;
};

export const areAllMatchingSelected = (selectedTemplates = [], matchingTemplates = []) => {
    if (matchingTemplates.length === 0) {
        return false;
    }

    const selectedIds = new Set(selectedTemplates.map(({ id }) => id).filter(Boolean));
    return matchingTemplates.every(({ id }) => selectedIds.has(id));
};

export const mergeSelectedWithMatching = (selectedTemplates = [], matchingTemplates = []) =>
    sortTemplatesAlphabetically(uniqueById([...selectedTemplates, ...matchingTemplates]));

export const clearMatchingFromSelection = (selectedTemplates = [], matchingTemplates = []) => {
    const matchingIds = new Set(matchingTemplates.map(({ id }) => id));
    return selectedTemplates.filter((item) => !matchingIds.has(item.id));
};

export const fetchAllMatchingTemplates = async ({
    searchFilter = "",
    pageSize = FETCH_PAGE_SIZE,
    search = genericSearchService,
} = {}) => {
    const filters = buildTemplateSearchFilters(searchFilter);
    const collected = [];
    let offset = 0;
    let total = Number.POSITIVE_INFINITY;

    while (offset < total) {
        const response = await search(
            `${TEMPLATES_SERVICE}/search`,
            filters,
            {
                limit: pageSize,
                offset,
            },
            null,
            true,
            null,
            TEMPLATES_ALPHABETICAL_ORDER,
        );
        const rows = Array.isArray(response?.data) ? response.data : [];
        const parsedTotal = Number(response?.total);
        total = Number.isFinite(parsedTotal) ? parsedTotal : offset + rows.length;

        collected.push(...rows.map(toTemplateOption));

        if (rows.length === 0 || rows.length < pageSize) {
            break;
        }

        offset += pageSize;
    }

    return sortTemplatesAlphabetically(uniqueById(collected));
};
