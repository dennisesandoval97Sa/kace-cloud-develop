import { apiService } from "@kace/utils";

// Backend Oleada 2 impone MAX_PAGE_SIZE=100 en CaseSearcher/RelationsCaseSearcher.
// Mantener este default alineado con ese tope: pedir más no devuelve más.
const defaultPagination = {
    limit: 100,
    offset: 0,
};

const VIEWS_WITHOUT_SOFT_DELETE = ["classifications-groups-relationships", "s3_import_files"];

const stripFilterLabel = ({ label: _label, ...rest }) => rest;

const getDefaultFilter = (filter, table, useDefault, relationship, order) => {
    const defaultFilter = {
        filter: filter.map(stripFilterLabel),
        relationship: relationship ? [...relationship] : null,
        order: order ?? {
            field: table ? `${table}.created_at` : "created_at",
            direction: "desc",
        },
    };

    if (useDefault && !VIEWS_WITHOUT_SOFT_DELETE.includes(table) && !table?.startsWith("view_")) {
        defaultFilter.filter.push({
            field: table ? `${table}.deleted_at` : "deleted_at",
            operator: "null",
            value: "null",
            type: "AND",
        });
    }

    if (table === "classifications-groups-relationships") {
        defaultFilter.filter = [...filter];
        defaultFilter.order = {
            field: "form",
            direction: "desc",
        };
    }

    return defaultFilter;
};

const getMetadataNumber = (value) => {
    if (value === null || value === undefined || value === "") {
        return undefined;
    }

    if (typeof value === "object" && !Array.isArray(value)) {
        return getMetadataTotal(value, undefined);
    }

    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : undefined;
};

const getMetadataTotal = (metadata = {}, fallback = 0) => {
    const totalCandidate = [
        metadata.count,
        metadata.total_records,
        metadata.totalRecords,
        metadata.total_items,
        metadata.totalItems,
        metadata.total_count,
        metadata.totalCount,
    ]
        .map(getMetadataNumber)
        .find((value) => value !== undefined);

    return totalCandidate !== undefined ? totalCandidate : fallback;
};

const normalizeData = (data) => {
    if (!data) return { data: [], count: 0, total: 0, metadata: {} };
    const items = data?.data?.data?.items || data?.data?.data || data?.data?.data?.items?.items;

    if (Array.isArray(items)) {
        const rawCount = data?.data?.metadata?.count;
        const parsedTotal = parseInt(rawCount?.count ?? rawCount, 10);

        return {
            data: items,
            count: items.length,
            total: isNaN(parsedTotal) ? items.length : parsedTotal,
            metadata: data?.data?.metadata || {},
        };
    }

    return { data: [], count: 0, total: 0, metadata: {} };
};

export const genericSearchService = async (
    url,
    filter = [],
    pagination = null,
    table = null,
    useDefault = true,
    relationship = null,
    order = null,
    bodyData = null,
) => {
    const combinedFilter = getDefaultFilter(filter, table, useDefault, relationship, order);
    const combinedPagination = pagination || defaultPagination;

    const body = {
        ...combinedFilter,
        ...combinedPagination,
    };

    try {
        const response = await apiService.post(url, bodyData ?? body);
        return normalizeData(response);
    } catch {
        // NO-SONAR: El mensaje de error es genérico para evitar exponer detalles técnicos y ofrecer una respuesta clara y comprensible al usuario.
        throw new Error("Lo sentimos, no es posible obtener los datos");
    }
};
