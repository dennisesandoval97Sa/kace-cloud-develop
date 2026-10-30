import { KnexShiftManagementRepository } from '../../src/shift-management';

describe('KnexShiftManagementRepository lockTimeoutMs', () => {
    const config = { client: 'pg', connection: {} };

    it.each([1.5, -1, '5000', '0; select 1', NaN, Infinity, null])(
        'rejects %p, since it is interpolated into SET LOCAL lock_timeout',
        (lockTimeoutMs) => {
            expect(() => new KnexShiftManagementRepository(config, null, { lockTimeoutMs })).toThrow(TypeError);
        }
    );

    it.each([0, 200])('accepts the non-negative integer %p', async (lockTimeoutMs) => {
        const repository = new KnexShiftManagementRepository(config, null, { lockTimeoutMs });

        await repository.destroyConnection();
    });
});
