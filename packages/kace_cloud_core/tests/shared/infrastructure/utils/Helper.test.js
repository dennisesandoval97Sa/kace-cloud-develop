// packages/kace_cloud_core/tests/shared/infrastructure/utils/Helper.test.js

import { jest } from '@jest/globals';

const ORIGINAL_ENV = { ...process.env };

function makeTenantStub({ debug = '0', level = null } = {}) {
    return {
        id: { value: 'tenant-test' },
        apps_debug: { value: debug },
        apps_debug_level: { value: level },
    };
}

async function loadHelperFresh() {
    jest.resetModules();
    delete process.env.APPS_DEBUG;
    delete process.env.APPS_DEBUG_OVERRIDE;
    delete process.env.APPS_DEBUG_LEVEL;
    // Re-import TenantContext alongside Helper so both reference the same
    // freshly-loaded module graph (Helper depends on TenantContext internally;
    // if the test held a stale top-level TenantContext, its AsyncLocalStorage
    // would not be the one Helper consults after resetModules).
    const tenantMod = await import('../../../../src/shared/infrastructure/context/TenantContext.js');
    const mod = await import('../../../../src/shared/infrastructure/utils/Helper.js');
    return { Helper: mod.Helper, TenantContext: tenantMod.TenantContext };
}

describe('Helper — tenant fallback (baseline)', () => {
    let consoleLog;
    let consoleError;

    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
        delete process.env.APPS_DEBUG;
        delete process.env.APPS_DEBUG_OVERRIDE;
        delete process.env.APPS_DEBUG_LEVEL;
        process.env.NODE_ENV = 'production'; // force structured-log path, not test path
        consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
        consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLog.mockRestore();
        consoleError.mockRestore();
        process.env = { ...ORIGINAL_ENV };
    });

    it('logDebug emits when tenant.apps_debug = "true" and no env vars set', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();
        await TenantContext.run(makeTenantStub({ debug: 'true', level: 1 }), async () => {
            Helper.logDebug('hello', { foo: 1 });
        });
        expect(consoleLog).toHaveBeenCalledTimes(1);
        expect(consoleLog.mock.calls[0][0]).toContain('"level":"DEBUG"');
    });

    it('logDebug stays silent when tenant.apps_debug = "false"', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();
        await TenantContext.run(makeTenantStub({ debug: 'false', level: 1 }), async () => {
            Helper.logDebug('hello');
        });
        expect(consoleLog).not.toHaveBeenCalled();
    });

    it('logDebug stays silent when there is no tenant in context', async () => {
        const { Helper } = await loadHelperFresh();
        Helper.logDebug('hello');
        expect(consoleLog).not.toHaveBeenCalled();
    });

    it('logDebug2 emits when tenant.apps_debug = "true" and apps_debug_level = 2', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();
        await TenantContext.run(makeTenantStub({ debug: 'true', level: 2 }), async () => {
            Helper.logDebug2('verbose');
        });
        expect(consoleLog).toHaveBeenCalledTimes(1);
        expect(consoleLog.mock.calls[0][0]).toContain('"level":"DEBUG2"');
    });

    it('logDebug2 stays silent when apps_debug_level = 1', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();
        await TenantContext.run(makeTenantStub({ debug: 'true', level: 1 }), async () => {
            Helper.logDebug2('verbose');
        });
        expect(consoleLog).not.toHaveBeenCalled();
    });
});

describe('Helper — APPS_DEBUG env var precedence', () => {
    let consoleLog;

    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
        delete process.env.APPS_DEBUG;
        delete process.env.APPS_DEBUG_OVERRIDE;
        delete process.env.APPS_DEBUG_LEVEL;
        process.env.NODE_ENV = 'production';
        consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLog.mockRestore();
        process.env = { ...ORIGINAL_ENV };
    });

    it('APPS_DEBUG="true" overrides tenant.apps_debug="false"', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();
        process.env.APPS_DEBUG = 'true';
        await TenantContext.run(makeTenantStub({ debug: 'false' }), async () => {
            Helper.logDebug('forced on');
        });
        expect(consoleLog).toHaveBeenCalledTimes(1);
    });

    it('APPS_DEBUG="false" overrides tenant.apps_debug="true"', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();
        process.env.APPS_DEBUG = 'false';
        await TenantContext.run(makeTenantStub({ debug: 'true' }), async () => {
            Helper.logDebug('forced off');
        });
        expect(consoleLog).not.toHaveBeenCalled();
    });

    it('APPS_DEBUG="1" is treated as true', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();
        process.env.APPS_DEBUG = '1';
        await TenantContext.run(makeTenantStub({ debug: 'false' }), async () => {
            Helper.logDebug('on via 1');
        });
        expect(consoleLog).toHaveBeenCalledTimes(1);
    });

    it('APPS_DEBUG="0" is treated as false', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();
        process.env.APPS_DEBUG = '0';
        await TenantContext.run(makeTenantStub({ debug: 'true' }), async () => {
            Helper.logDebug('off via 0');
        });
        expect(consoleLog).not.toHaveBeenCalled();
    });

    it('APPS_DEBUG="invalido" falls through to APPS_DEBUG_OVERRIDE', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();
        process.env.APPS_DEBUG = 'invalido';
        process.env.APPS_DEBUG_OVERRIDE = 'true';
        await TenantContext.run(makeTenantStub({ debug: 'false' }), async () => {
            Helper.logDebug('falls to override');
        });
        expect(consoleLog).toHaveBeenCalledTimes(1);
    });

    it('APPS_DEBUG="" (empty string) falls through to tenant', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();
        process.env.APPS_DEBUG = '';
        await TenantContext.run(makeTenantStub({ debug: 'true' }), async () => {
            Helper.logDebug('falls to tenant');
        });
        expect(consoleLog).toHaveBeenCalledTimes(1);
    });

    it('APPS_DEBUG_OVERRIDE still works when APPS_DEBUG is unset (backwards compat)', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();
        process.env.APPS_DEBUG_OVERRIDE = 'true';
        await TenantContext.run(makeTenantStub({ debug: 'false' }), async () => {
            Helper.logDebug('legacy override');
        });
        expect(consoleLog).toHaveBeenCalledTimes(1);
    });
});

describe('Helper — APPS_DEBUG_LEVEL env var precedence', () => {
    let consoleLog;

    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
        delete process.env.APPS_DEBUG;
        delete process.env.APPS_DEBUG_OVERRIDE;
        delete process.env.APPS_DEBUG_LEVEL;
        process.env.NODE_ENV = 'production';
        consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLog.mockRestore();
        process.env = { ...ORIGINAL_ENV };
    });

    it('APPS_DEBUG_LEVEL="2" enables logDebug2 even if tenant level is 1', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();
        process.env.APPS_DEBUG = 'true';
        process.env.APPS_DEBUG_LEVEL = '2';
        await TenantContext.run(makeTenantStub({ debug: 'true', level: 1 }), async () => {
            Helper.logDebug2('verbose');
        });
        expect(consoleLog).toHaveBeenCalledTimes(1);
        expect(consoleLog.mock.calls[0][0]).toContain('"level":"DEBUG2"');
    });

    it('APPS_DEBUG_LEVEL="1" silences logDebug2 even if tenant level is 2', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();
        process.env.APPS_DEBUG = 'true';
        process.env.APPS_DEBUG_LEVEL = '1';
        await TenantContext.run(makeTenantStub({ debug: 'true', level: 2 }), async () => {
            Helper.logDebug2('should be silent');
        });
        expect(consoleLog).not.toHaveBeenCalled();
    });

    it('APPS_DEBUG_LEVEL unset → falls through to tenant.apps_debug_level', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();
        process.env.APPS_DEBUG = 'true';
        await TenantContext.run(makeTenantStub({ debug: 'true', level: 2 }), async () => {
            Helper.logDebug2('tenant level wins');
        });
        expect(consoleLog).toHaveBeenCalledTimes(1);
    });

    it('APPS_DEBUG_LEVEL="invalido" falls through to tenant.apps_debug_level', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();
        process.env.APPS_DEBUG = 'true';
        process.env.APPS_DEBUG_LEVEL = 'invalido';
        await TenantContext.run(makeTenantStub({ debug: 'true', level: 2 }), async () => {
            Helper.logDebug2('still verbose via tenant');
        });
        expect(consoleLog).toHaveBeenCalledTimes(1);
    });

    it('APPS_DEBUG_LEVEL="" (empty) is treated as unset', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();
        process.env.APPS_DEBUG = 'true';
        process.env.APPS_DEBUG_LEVEL = '';
        await TenantContext.run(makeTenantStub({ debug: 'true', level: 2 }), async () => {
            Helper.logDebug2('empty string falls through');
        });
        expect(consoleLog).toHaveBeenCalledTimes(1);
    });
});

describe('Helper — multi-tenant correctness (loadTenant cache fix)', () => {
    let consoleLog;

    beforeEach(() => {
        process.env = { ...ORIGINAL_ENV };
        delete process.env.APPS_DEBUG;
        delete process.env.APPS_DEBUG_OVERRIDE;
        delete process.env.APPS_DEBUG_LEVEL;
        process.env.NODE_ENV = 'production';
        consoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        consoleLog.mockRestore();
        process.env = { ...ORIGINAL_ENV };
    });

    it('respects per-tenant flags in the same warm process', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();

        const tenantA = {
            id: { value: 'tenant-A' },
            apps_debug: { value: 'true' },
            apps_debug_level: { value: 1 },
        };
        const tenantB = {
            id: { value: 'tenant-B' },
            apps_debug: { value: 'false' },
            apps_debug_level: { value: 1 },
        };

        await TenantContext.run(tenantA, async () => {
            Helper.logDebug('A speaking');
        });
        await TenantContext.run(tenantB, async () => {
            Helper.logDebug('B should be silent');
        });

        expect(consoleLog).toHaveBeenCalledTimes(1);
        expect(consoleLog.mock.calls[0][0]).toContain('A speaking');
    });

    it('caches per-tenant within the TTL window', async () => {
        const { Helper, TenantContext } = await loadHelperFresh();

        const tenant = {
            id: { value: 'tenant-cache' },
            apps_debug: { value: 'true' },
            apps_debug_level: { value: 2 },
        };

        await TenantContext.run(tenant, async () => {
            Helper.logDebug('first');
            Helper.logDebug2('second');
        });

        expect(consoleLog).toHaveBeenCalledTimes(2);
        expect(consoleLog.mock.calls[0][0]).toContain('"level":"DEBUG"');
        expect(consoleLog.mock.calls[1][0]).toContain('"level":"DEBUG2"');
    });
});
