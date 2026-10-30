import { AssignationsEnum, ValueObjectEnum } from '../../shared';

export class ValueObjectAssignation extends ValueObjectEnum {
    constructor(field, value) {
        super(field, value, Object.values(AssignationsEnum.toJson()));
    }
}
