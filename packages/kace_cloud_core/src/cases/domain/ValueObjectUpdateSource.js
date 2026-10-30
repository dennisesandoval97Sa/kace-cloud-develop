import { Helper, ValueObjectString } from '../../shared';

export class ValueObjectUpdateSource extends ValueObjectString {
    static BULK = 'bulk';
    static MANUAL = 'manual';

    static fromCasesCount(count) {
        const value = count > 1 ? ValueObjectUpdateSource.BULK : ValueObjectUpdateSource.MANUAL;

        return new ValueObjectUpdateSource('update_source', value, false);
    }

    constructor(field, value, nullable) {
        super(field, value, nullable);

        if (value == null && nullable) {
            return;
        }
        if (value !== ValueObjectUpdateSource.BULK && value !== ValueObjectUpdateSource.MANUAL) {
            Helper.logError(
                `updateSource must be '${ValueObjectUpdateSource.BULK}' or '${ValueObjectUpdateSource.MANUAL}'`
            );
            throw new Error(
                `updateSource must be '${ValueObjectUpdateSource.BULK}' or '${ValueObjectUpdateSource.MANUAL}'`
            );
        }
    }
}
