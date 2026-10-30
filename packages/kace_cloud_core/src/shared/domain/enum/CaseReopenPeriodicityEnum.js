export class CaseReopenPeriodicityEnum {
    static PERIODICALLY = new CaseReopenPeriodicityEnum('PERIODICALLY', 'periodicamente');
    static ACTUAL_MONTHLY = new CaseReopenPeriodicityEnum('ACTUAL_MONTHLY', 'mes_actual');
    static SPECIFIC_DAY = new CaseReopenPeriodicityEnum('SPECIFIC_DAY', 'dia_especifico');

    constructor(key, value) {
        this.#ensureIsValidPeriodicity(value);

        this.key = key;
        this.value = value;

        Object.freeze(this);
    }

    static fromValue(value) {
        if (value === 'periodicamente') {
            return CaseReopenPeriodicityEnum.PERIODICALLY;
        }
        if (value === 'mes_actual') {
            return CaseReopenPeriodicityEnum.ACTUAL_MONTHLY;
        }
        if (value === 'dia_especifico') {
            return CaseReopenPeriodicityEnum.SPECIFIC_DAY;
        }
        throw new Error('Invalid value');
    }

    static toJson() {
        return {
            PERIODICALLY: CaseReopenPeriodicityEnum.PERIODICALLY.value,
            ACTUAL_MONTHLY: CaseReopenPeriodicityEnum.ACTUAL_MONTHLY.value,
            SPECIFIC_DAY: CaseReopenPeriodicityEnum.SPECIFIC_DAY.value,
        };
    }

    #ensureIsValidPeriodicity(value) {
        if (!value) {
            throw new Error('The value cannot be null');
        }
        if (value !== 'periodicamente' && value !== 'mes_actual' && value !== 'dia_especifico') {
            throw new Error(`The value must be a valid Periodicity: ${value}`);
        }
    }
}
