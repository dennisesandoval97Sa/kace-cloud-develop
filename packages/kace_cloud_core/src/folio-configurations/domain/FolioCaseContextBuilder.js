/**
 * Builds the object that folio field paths are resolved against.
 *
 * The keys mirror `KnexCaseRepository.getCaseContextById` exactly, so a path picked in
 * the UI (`aux_cases.form.grupo.campo`, `cases.external_code`, `clasificaciones.nivel1`)
 * behaves here the same way it does in the action rules. That method cannot be reused
 * directly because at creation time the case does not exist yet.
 *
 * Only `cases`, `aux_cases` and `clasificaciones` are populated: the three are already in
 * hand when a case is created, so building the context costs no extra query on the path
 * that also serialises the counter. `clients`, `aux_clients` and `estados` are left as
 * empty objects — a path into them resolves to undefined and the segment reports a clear
 * error rather than silently rendering nothing.
 */
export class FolioCaseContextBuilder {
    /**
     * @param {Object} params
     * @param {Object} params.caseDto - the validated case payload
     * @param {Object} [params.auxData] - `aux_cases.data`, already unwrapped
     * @param {Object} [params.classification] - the `clasificaciones` row
     * @returns {Object}
     */
    static build({ caseDto, auxData, classification }) {
        return {
            cases: caseDto ?? {},
            aux_cases: auxData ?? {},
            clasificaciones: classification ?? {},
            clients: {},
            aux_clients: {},
            estados: {},
        };
    }
}
