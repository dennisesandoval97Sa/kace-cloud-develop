import { Types } from '../../domain/Types.js';

export class TypeLister {
    execute() {
        return [Types.DAYS, Types.HOURS, Types.MINUTES];
    }
}
