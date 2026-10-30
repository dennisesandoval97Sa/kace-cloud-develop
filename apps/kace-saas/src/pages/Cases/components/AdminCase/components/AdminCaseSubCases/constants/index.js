import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { FILTER_TRANSFORMATIONS } from "@/pages/Cases/components/CaseDataTable/constants";

export const getSubcasesDataTableConfig = (caseId) => ({
    url: `${URL_AND_KEYS.cases.url}/${caseId}/sub-cases/search`,
    key: `subcases-${caseId}`,
    /*
     * Sin persistencia: la clave lleva el caso, asi que cada caso visitado
     * dejaria su propia entrada en el storage y creceria sin limite. Ademas es
     * una tabla embebida en el detalle del caso, no una vista de trabajo.
     */
    persist: false,
    view: null,
    genericColumns: [
        "reference",
        "nivel1",
        "nombres",
        "nombre_cliente",
        "estado_actual",
        "created_at",
        "updated_at",
        "antiguedad_dias",
        "fecha_resolucion",
    ],
    entity: URL_AND_KEYS.cases.entity,
    forceUrl: true,
    useDefaultFilters: false,
});

export { FILTER_TRANSFORMATIONS };
