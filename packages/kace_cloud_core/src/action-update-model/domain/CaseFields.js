export class CaseFields {
    static RESPONSABLE_ID = new CaseFields('Responsable id', 'responsable_id');
    static GRUPO_ID = new CaseFields('Grupo id', 'grupo_id');
    static FECHA_RESOLUCION = new CaseFields('Fecha resolución', 'fecha_resolucion');
    static MOTIVO_BAJA = new CaseFields('Motivo baja', 'motivo_baja');
    static ALTO_IMPACTO = new CaseFields('Alto impacto', 'alto_impacto');

    /**
     * @type {string}
     * is initialized in the constructor
     */
    key;

    /**
     * @type {string}
     * is initialized in the constructor
     */
    value;

    constructor(key, value) {
        this.#ensureIsValidCampo(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        const map = {
            responsable_id: CaseFields.RESPONSABLE_ID,
            grupo_id: CaseFields.GRUPO_ID,
            fecha_resolucion: CaseFields.FECHA_RESOLUCION,
            motivo_baja: CaseFields.MOTIVO_BAJA,
            alto_impacto: CaseFields.ALTO_IMPACTO,
        };

        if (!map[value]) {
            throw new Error(`Invalid campo value: ${value}`);
        }
        return map[value];
    }

    #ensureIsValidCampo(value) {
        const validValues = new Set(['responsable_id', 'grupo_id', 'fecha_resolucion', 'motivo_baja', 'alto_impacto']);
        if (!validValues.has(value)) {
            throw new Error(`The value must be a valid campo value: ${value}`);
        }
    }

    static toJson() {
        const json = {};
        for (const key of Object.keys(CaseFields)) {
            if (CaseFields[key] instanceof CaseFields) {
                json[key] = CaseFields[key].value;
            }
        }
        return json;
    }
}
