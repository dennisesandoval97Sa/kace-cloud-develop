import { jest } from '@jest/globals';

jest.unstable_mockModule('@kace/api-common', () => ({
    TenantContextManager: { invalidateTenant: jest.fn() },
}));

jest.unstable_mockModule('@kace/core/src/shared/infrastructure/utils/Helper.js', () => ({
    Helper: { logInfo: jest.fn(), logError: jest.fn(), logDebug: jest.fn() },
}));

const { TenantDebugFlag } = await import('../src/services/TenantDebugFlag.mjs');

const buildClient = (sendImpl) => ({ send: jest.fn(sendImpl ?? (async () => ({}))) });

describe('TenantDebugFlag.disable', () => {
    test('issues a surgical UpdateCommand touching only apps_debug/updated_at/updated_by', async () => {
        let input;
        const client = buildClient(async (cmd) => {
            input = cmd.input;
            return {};
        });
        const invalidate = jest.fn();
        const flag = new TenantDebugFlag({ client, tableName: 'kace_multi_tenancy', invalidate });

        const result = await flag.disable('acme');

        expect(result).toEqual({ updated: true });
        expect(input.TableName).toBe('kace_multi_tenancy');
        expect(input.Key).toEqual({ id: 'acme' });
        // Only these three attributes are written — nothing else is replaced.
        expect(input.UpdateExpression).toBe('SET apps_debug = :d, updated_at = :ua, updated_by = :ub');
        expect(input.ExpressionAttributeValues[':d']).toBe('false');
        expect(typeof input.ExpressionAttributeValues[':ua']).toBe('string'); // ISO string, not a Date
        expect(input.ExpressionAttributeValues[':ub']).toBeTruthy();
        // Guards against creating a phantom tenant on a wrong id.
        expect(input.ConditionExpression).toBe('attribute_exists(id)');
        expect(invalidate).toHaveBeenCalledWith('acme');
    });

    test('returns updated:false and does NOT call the client when tenantId is missing', async () => {
        const client = buildClient();
        const flag = new TenantDebugFlag({ client, tableName: 't', invalidate: jest.fn() });

        const result = await flag.disable(undefined);

        expect(result).toEqual({ updated: false });
        expect(client.send).not.toHaveBeenCalled();
    });

    test('swallows AWS errors (e.g. ConditionalCheckFailed) without breaking the flow', async () => {
        const client = buildClient(async () => {
            throw Object.assign(new Error('nope'), { name: 'ConditionalCheckFailedException' });
        });
        const invalidate = jest.fn();
        const flag = new TenantDebugFlag({ client, tableName: 't', invalidate });

        const result = await flag.disable('ghost');

        expect(result).toEqual({ updated: false });
        expect(invalidate).not.toHaveBeenCalled();
    });
});
