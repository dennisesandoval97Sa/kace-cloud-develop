/**
 * JOIN aux_cases al listado de subcasos (POST .../sub-cases/search).
 * Debe coincidir con la documentación del API (aux_cases.caso_id = cases.id).
 *
 * En `select`, las expresiones sobre `aux_cases.data` pueden usar comodín de primer nivel
 * `->'*'` (ver buildAuxSearchParams / formulario Columnas auxiliares).
 */
export const AUX_CASES_RELATIONSHIP = {
  table: 'aux_cases',
  condition: {
    column: 'aux_cases.caso_id',
    refColumn: 'cases.id',
  },
  type: 'left',
};
