import { DomainError } from '../../shared/index.js';

export class Idp {
    async authenticate(serviceAccount) {
        throw new DomainError('authenticate method not implemented');
    }
}
