import { Guards, ValueObjectString } from '../../../shared';

export class ValueObjectCacheExpiresInPath extends ValueObjectString {
    constructor(value) {
        super('cache_expires_in_path', value, true);

        if (value != null) {
            Guards.stringMaxLength(this, 255);
        }
    }
}
