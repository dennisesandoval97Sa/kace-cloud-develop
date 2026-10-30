import { CaseReopenPeriodicityEnum, ValueObjectEnum } from '../../shared';

export class ValueObjectPeriodicityCaseReopen extends ValueObjectEnum {
    constructor(field, value) {
        super(field, value, Object.values(CaseReopenPeriodicityEnum.toJson()));
    }
}
