import { jest } from '@jest/globals';

const fakeSend = jest.fn();
const fakeSSMClientCtor = jest.fn(() => ({ send: fakeSend }));
const fakeGetParameterCommand = jest.fn((input) => ({ __cmd: 'GetParameter', input }));
jest.unstable_mockModule('@aws-sdk/client-ssm', () => ({
    SSMClient: fakeSSMClientCtor,
    GetParameterCommand: fakeGetParameterCommand,
}));

const fakeLogError = jest.fn();
jest.unstable_mockModule('@kace/core/src/shared/index.js', () => ({
    Helper: {
        logError: fakeLogError,
        logInfo: jest.fn(),
        logDebug: jest.fn(),
    },
}));

const { DebugOverride } = await import('../src/DebugOverride.mjs');

describe('DebugOverride', () => {
    let originalEnv;

    beforeEach(() => {
        originalEnv = process.env.APPS_DEBUG_OVERRIDE;
        delete process.env.APPS_DEBUG_OVERRIDE;
        fakeSend.mockReset();
        fakeSSMClientCtor.mockClear();
        fakeGetParameterCommand.mockClear();
        fakeLogError.mockClear();
    });

    afterEach(() => {
        if (originalEnv === undefined) {
            delete process.env.APPS_DEBUG_OVERRIDE;
        } else {
            process.env.APPS_DEBUG_OVERRIDE = originalEnv;
        }
    });

    it('sets env to "true" when SSM parameter value is "true"', async () => {
        fakeSend.mockResolvedValueOnce({ Parameter: { Value: 'true' } });
        const sut = new DebugOverride({ parameterName: '/x/log-debug', region: 'us-east-1' });

        await sut.fetchAndApply();

        expect(process.env.APPS_DEBUG_OVERRIDE).toBe('true');
        expect(fakeGetParameterCommand).toHaveBeenCalledWith({ Name: '/x/log-debug' });
        expect(fakeLogError).not.toHaveBeenCalled();
    });

    it('sets env to "false" when SSM parameter value is "false"', async () => {
        fakeSend.mockResolvedValueOnce({ Parameter: { Value: 'false' } });
        const sut = new DebugOverride({ parameterName: '/x/log-debug', region: 'us-east-1' });

        await sut.fetchAndApply();

        expect(process.env.APPS_DEBUG_OVERRIDE).toBe('false');
        expect(fakeLogError).not.toHaveBeenCalled();
    });

    it('treats ParameterNotFound as silent OFF (no error log)', async () => {
        const err = new Error('Parameter not found');
        err.name = 'ParameterNotFound';
        fakeSend.mockRejectedValueOnce(err);
        const sut = new DebugOverride({ parameterName: '/x/log-debug', region: 'us-east-1' });

        await sut.fetchAndApply();

        expect(process.env.APPS_DEBUG_OVERRIDE).toBe('false');
        expect(fakeLogError).not.toHaveBeenCalled();
    });

    it('logs and defaults to OFF on non-NotFound errors (e.g. AccessDenied)', async () => {
        const err = new Error('Access denied');
        err.name = 'AccessDeniedException';
        fakeSend.mockRejectedValueOnce(err);
        const sut = new DebugOverride({ parameterName: '/x/log-debug', region: 'us-east-1' });

        await sut.fetchAndApply();

        expect(process.env.APPS_DEBUG_OVERRIDE).toBe('false');
        expect(fakeLogError).toHaveBeenCalledWith(
            'DebugOverride.fetch.failed',
            expect.objectContaining({
                parameterName: '/x/log-debug',
                errorName: 'AccessDeniedException',
            })
        );
    });

    it('skips SSM entirely when parameterName is empty', async () => {
        const sut = new DebugOverride({ parameterName: '', region: 'us-east-1' });

        await sut.fetchAndApply();

        expect(process.env.APPS_DEBUG_OVERRIDE).toBe('false');
        expect(fakeSend).not.toHaveBeenCalled();
        expect(fakeLogError).not.toHaveBeenCalled();
    });
});
