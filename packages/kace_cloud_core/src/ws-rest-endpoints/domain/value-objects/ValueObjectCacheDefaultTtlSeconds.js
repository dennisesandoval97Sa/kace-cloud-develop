import { ValueObjectInt } from '../../../shared/domain/value-object/ValueObjectInt';

export class ValueObjectCacheDefaultTtlSeconds extends ValueObjectInt {
    constructor(value) {
        super('cache_default_ttl_seconds', value, true);
    }
}
