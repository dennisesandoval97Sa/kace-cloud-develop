export class CaseAttachmentTypeEnum {
    static RECEPCION = new CaseAttachmentTypeEnum('RECEPCION', 1);
    static ENVIO = new CaseAttachmentTypeEnum('ENVIO', 2);

    constructor(key, value) {
        this.#ensureIsValidAttachmentType(value);

        this.key = key;
        this.value = value;
        Object.freeze(this);
    }

    #ensureIsValidAttachmentType(value) {
        if (!value) throw new Error(`Invalid value: ${value}`);

        if (value !== 1 && value !== 2) {
            throw new Error(`The value must be a valid assignation: ${value}`);
        }
    }

    static fromValue(value) {
        if (value === 1) return CaseAttachmentTypeEnum.RECEPCION;
        if (value === 2) return CaseAttachmentTypeEnum.ENVIO;
        throw new Error(`Invalid value: ${value}. Allowed values are:  1, 2`);
    }

    static toJson() {
        return {
            RECEPCION: CaseAttachmentTypeEnum.RECEPCION.value,
            ENVIO: CaseAttachmentTypeEnum.ENVIO.value,
        };
    }
}
