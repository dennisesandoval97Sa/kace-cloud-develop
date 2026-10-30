import { KnexViewCaseRepository } from '../../../../src/cases/infrastructure/persistence/KnexViewCaseRepository.js';
import { InvalidArgumentError } from '../../../../src/shared/errors/InvalidArgumentError.js';

describe('KnexViewCaseRepository matview prefix allowlist', () => {
    const config = { client: 'pg', connection: { filename: ':memory:' } };

    it('rejects a matview prefix with non-identifier characters at construction', () => {
        expect(() => new KnexViewCaseRepository(config, undefined, null, 'mv"; DROP TABLE x; --')).toThrow(
            InvalidArgumentError
        );
    });

    it('accepts a normal alphanumeric/underscore prefix', () => {
        expect(() => new KnexViewCaseRepository(config, undefined, null, 'mv_tenant_42')).not.toThrow();
    });

    it('accepts the default prefix', () => {
        expect(() => new KnexViewCaseRepository(config, undefined, null)).not.toThrow();
    });
});
