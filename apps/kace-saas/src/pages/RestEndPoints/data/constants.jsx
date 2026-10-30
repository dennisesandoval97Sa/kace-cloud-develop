import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { WSRestEndpointType } from "../../../enums/WSRestEndpointType";

export const HEADERS_CONSTANT_WS_REST_ENDPOINTS = [
    "description",
    "type",
    "url",
    "method",
    "is_active",
    "updated_at",
    "created_at",
];

export const INITIAL_VALUES_WS_REST_ENDPOINTS = {
    description: "",
    type: "",
    url: "",
    method: "",
    headers: "{}",
    body: "{}",
    body_type: "json",
    authorization_id: "",
    is_dynamic_body: true,
    is_dynamic_header: false,
    filter_input: "",
    context_position: "",
    on_success: "",
    on_error: "",
    attempts: 0,
    is_active: true,
    cache_expires_in_path: "",
    cache_default_ttl_seconds: "",
    initial_context: "{}",
};

export const TYPES_WS_REST_ENDPOINTS = (t) => {
    return [
        { id: WSRestEndpointType.AUTHORIZATION.value, label: t("restEndPoint.list.authorization") },
        { id: WSRestEndpointType.CONSUMPTION.value, label: t("restEndPoint.list.consumption") },
    ];
};
export const METHODS_WS_REST_ENDPOINTS = ["GET", "POST", "PUT", "DELETE"];
export const FILTER_LIST_OPTIONS_AUTHORIZATION = [
    {
        field: "type",
        operator: "eq",
        value: "authorization",
        type: "AND",
    },
];

export const JSON_FIELDS = ["headers", "body", "on_error", "on_success", "initial_context"];

export const RESPONSE_CODES = [
    { code: 200, description: "OK" },
    { code: 201, description: "Created" },
    { code: 202, description: "Accepted" },
    { code: 204, description: "No Content" },
    { code: 301, description: "Moved Permanently" },
    { code: 304, description: "Not Modified" },
    { code: 307, description: "Temporary Redirect" },
    { code: 308, description: "Permanent Redirect" },
    { code: 400, description: "Bad Request" },
    { code: 401, description: "Unauthorized" },
    { code: 403, description: "Forbidden" },
    { code: 404, description: "Not Found" },
    { code: 405, description: "Method not Allowed" },
    { code: 408, description: "Request Timeout" },
    { code: 413, description: "Content Too Large" },
    { code: 429, description: "Too Many Requests" },
    { code: 500, description: "Internal Server Error" },
    { code: 502, description: "Bad Gateway" },
    { code: 503, description: "Service Unavailable" },
    { code: 504, description: "Gateway Timeout" },
];

export const SUCCESS_RESPONSE_CODES = RESPONSE_CODES.filter((c) => c.code < 400);
export const ERROR_RESPONSE_CODES = RESPONSE_CODES.filter((c) => c.code >= 400);

export const dataTableConfig = {
    key: URL_AND_KEYS.restEndpoints.key,
    url: URL_AND_KEYS.restEndpoints.url,
    view: URL_AND_KEYS.restEndpoints.view,
    genericColumns: HEADERS_CONSTANT_WS_REST_ENDPOINTS,
    entity: URL_AND_KEYS.restEndpoints.entity,
};

export const FILTER_TRANSFORMATIONS = {
    description: (row) => ({
        ...row,
        label: "Description",
        filterData: {
            field: "ws_rest_endpoints.description",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    type: (row) => ({
        ...row,
        label: "Type",
        filterData: {
            field: "ws_rest_endpoints.type",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    url: (row) => ({
        ...row,
        label: "URL",
        filterData: {
            field: "ws_rest_endpoints.url",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    method: (row) => ({
        ...row,
        label: "Method",
        filterData: {
            field: "ws_rest_endpoints.method",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
    is_active: (row) => ({
        ...row,
        field_type: "boolean",
        filterData: {
            field: "ws_rest_endpoints.is_active",
            operator: "eq",
            type: "AND",
            value: "",
        },
    }),
};
