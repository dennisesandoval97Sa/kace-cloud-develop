import {
    DATE_FORMATS as DOMAIN_DATE_FORMATS,
    MAX_SEQUENCE_LENGTH as DOMAIN_MAX_SEQUENCE_LENGTH,
    OVERFLOW_POLICIES as DOMAIN_OVERFLOW_POLICIES,
    RESET_POLICIES as DOMAIN_RESET_POLICIES,
    SEGMENT_TYPES as DOMAIN_SEGMENT_TYPES,
} from "@kace/core/src/folio-configurations/domain/segments/segmentCatalog.js";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

export const INITIAL_VALUES_FOLIO_CONFIGURATION = {
    nombre: "",
    descripcion: "",
    status: 1,
    reset_policy: "never",
    start_value: 1,
    overflow_policy: "fail",
    segments: [{ type: "sequence", length: 6, pad_char: "0" }],
};

export const HEADERS_CONSTANT_FOLIO_CONFIGURATIONS = ["nombre", "descripcion", "status", "updated_at", "created_at"];

export const dataTableConfig = {
    key: URL_AND_KEYS.folioConfigurations.key,
    url: URL_AND_KEYS.folioConfigurations.url,
    view: URL_AND_KEYS.folioConfigurations.view,
    genericColumns: HEADERS_CONSTANT_FOLIO_CONFIGURATIONS,
    entity: URL_AND_KEYS.folioConfigurations.entity,
};

export const FILTER_TRANSFORMATIONS = {
    nombre: (row) => ({
        ...row,
        filterData: {
            field: "nombre",
            operator: "ilike",
            type: "AND",
            value: "",
        },
    }),
};

/** Same vocabulary the domain validates against (segmentCatalog.js), plus its label. */
export const SEGMENT_TYPES = DOMAIN_SEGMENT_TYPES.map((value) => ({
    value,
    labelKey: `folioConfigurations.segments.types.${value}`,
}));

/** Closed whitelist: a free-form format would silently change the folio width. */
export const DATE_FORMATS = DOMAIN_DATE_FORMATS;

export const RESET_POLICIES = DOMAIN_RESET_POLICIES;

export const OVERFLOW_POLICIES = DOMAIN_OVERFLOW_POLICIES;

/** The counter columns are int4, so the domain caps the consecutive at this many digits. */
export const MAX_SEQUENCE_LENGTH = DOMAIN_MAX_SEQUENCE_LENGTH;

/** Default params when the user switches a segment to a given type. */
export const SEGMENT_DEFAULTS = {
    literal: { type: "literal", value: "" },
    date: { type: "date", format: "YY" },
    field: { type: "field", path: "" },
    sequence: { type: "sequence", length: 6, pad_char: "0" },
};
