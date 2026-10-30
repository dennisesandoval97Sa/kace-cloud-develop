import { ValueObjectJson } from '@kace/core/src/shared';

export class VOBoardHavings extends ValueObjectJson {
    constructor(value) {
        super('havings', value, true);
    }
}
