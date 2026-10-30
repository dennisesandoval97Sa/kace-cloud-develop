import { Types } from '../../domain/Types.js';

export class TypeLister {
    execute() {
        return [Types.ALFANUMERICO, Types.NUMERO, Types.FORMULA];
    }
}
