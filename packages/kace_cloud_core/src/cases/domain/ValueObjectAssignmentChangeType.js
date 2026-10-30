import { Helper, ValueObjectString } from '../../shared';

export class ValueObjectAssignmentChangeType extends ValueObjectString {
    static MANUAL = 'manual';
    static ACTION = 'action';
    static AUTOMATIC = 'automatic';
    static CREATION = 'creation';
    static BULK = 'bulk';

    static VALID_VALUES = Object.freeze([
        ValueObjectAssignmentChangeType.MANUAL,
        ValueObjectAssignmentChangeType.ACTION,
        ValueObjectAssignmentChangeType.AUTOMATIC,
        ValueObjectAssignmentChangeType.CREATION,
        ValueObjectAssignmentChangeType.BULK,
    ]);

    constructor(field, value, nullable) {
        super(field, value, nullable);

        if (value == null && nullable) {
            return;
        }
        if (!ValueObjectAssignmentChangeType.VALID_VALUES.includes(value)) {
            const message = `assignmentChangeType must be one of '${ValueObjectAssignmentChangeType.VALID_VALUES.join(
                "', '"
            )}'`;
            Helper.logError(message);
            throw new Error(message);
        }
    }
}
