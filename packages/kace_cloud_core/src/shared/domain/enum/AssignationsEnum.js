export class AssignationsEnum {
    static COLA_DE_TRABAJO = new AssignationsEnum('COLA_DE_TRABAJO', 'cola_de_trabajo');
    static ASIGNACION_EQUIVALENTE = new AssignationsEnum('ASIGNACION_EQUIVALENTE', 'asignacion_equivalente');

    constructor(key, value) {
        this.#ensureIsValidAssignation(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        if (value === 'cola_de_trabajo') {
            return AssignationsEnum.COLA_DE_TRABAJO;
        }
        if (value === 'asignacion_equivalente') {
            return AssignationsEnum.ASIGNACION_EQUIVALENTE;
        }

        throw new Error('Invalid value');
    }

    static toJson() {
        return {
            COLA_DE_TRABAJO: AssignationsEnum.COLA_DE_TRABAJO.value,
            ASIGNACION_EQUIVALENTE: AssignationsEnum.ASIGNACION_EQUIVALENTE.value,
        };
    }

    #ensureIsValidAssignation(value) {
        if (!value) {
            throw new Error('The value cannot be null');
        }

        if (value !== 'cola_de_trabajo' && value !== 'asignacion_equivalente') {
            throw new Error(`The value must be a valid assignation: ${value}`);
        }
    }
}
