import { HttpResponse, SearchSchema } from '../../src/index.js';

const MANAGED_ENV_KEYS = ['NODE_ENV', 'APPS_ENVIRONMENT', 'APPS_DEBUG', 'APPS_DEBUG_OVERRIDE'];
const ORIGINAL_ENV = Object.fromEntries(MANAGED_ENV_KEYS.map((key) => [key, process.env[key]]));

function setEnv(values) {
    for (const key of MANAGED_ENV_KEYS) {
        if (Object.hasOwn(values, key)) {
            if (values[key] === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = values[key];
            }
        } else {
            delete process.env[key];
        }
    }
}

function restoreEnv() {
    for (const [key, value] of Object.entries(ORIGINAL_ENV)) {
        if (value === undefined) {
            delete process.env[key];
        } else {
            process.env[key] = value;
        }
    }
}

function eventFixture({ debug = 'false' } = {}) {
    return {
        headers: { origin: 'https://admin.appsmx.net' },
        kContext: { awsRequestId: 'request-id-1' },
        tenant: { apps_debug: { value: debug } },
        tenantContext: {
            tenant: {
                apps_allowed_origins: { value: 'https://admin.appsmx.net' },
                apps_debug: { value: debug },
            },
        },
    };
}

function validationBody({ tenantDebug } = {}) {
    const data = SearchSchema.validate({ id: 'invalid' });
    const response = HttpResponse.validationsFail({
        errors: data.error,
        event: eventFixture({ debug: tenantDebug }),
    }).toJson();

    return JSON.parse(response.body);
}

function exposesDetails(body) {
    return (body.errors ?? []).some((error) => error.field === 'limit' && error.message?.includes('is required'));
}

describe('public error debug gate precedence', () => {
    afterEach(() => {
        restoreEnv();
    });

    it('exposes details when APPS_DEBUG is "true" and tenant debug is disabled', () => {
        setEnv({ NODE_ENV: 'staging', APPS_DEBUG: 'true' });

        expect(exposesDetails(validationBody({ tenantDebug: 'false' }))).toBe(true);
    });

    it('suppresses details when APPS_DEBUG is "false" and tenant debug is enabled', () => {
        setEnv({ NODE_ENV: 'staging', APPS_DEBUG: 'false' });

        expect(exposesDetails(validationBody({ tenantDebug: 'true' }))).toBe(false);
    });

    it('falls through to tenant debug when APPS_DEBUG is an empty string', () => {
        setEnv({ NODE_ENV: 'staging', APPS_DEBUG: '' });

        expect(exposesDetails(validationBody({ tenantDebug: 'true' }))).toBe(true);
    });

    it('treats APPS_DEBUG "1" as enabled', () => {
        setEnv({ NODE_ENV: 'staging', APPS_DEBUG: '1' });

        expect(exposesDetails(validationBody({ tenantDebug: 'false' }))).toBe(true);
    });

    it('treats APPS_DEBUG "0" as disabled', () => {
        setEnv({ NODE_ENV: 'staging', APPS_DEBUG: '0' });

        expect(exposesDetails(validationBody({ tenantDebug: 'true' }))).toBe(false);
    });

    it('falls through to APPS_DEBUG_OVERRIDE when APPS_DEBUG is not a recognized boolean', () => {
        setEnv({ NODE_ENV: 'staging', APPS_DEBUG: 'invalido', APPS_DEBUG_OVERRIDE: 'true' });

        expect(exposesDetails(validationBody({ tenantDebug: 'false' }))).toBe(true);
    });

    it('honours APPS_DEBUG_OVERRIDE when APPS_DEBUG is unset', () => {
        setEnv({ NODE_ENV: 'staging', APPS_DEBUG_OVERRIDE: 'true' });

        expect(exposesDetails(validationBody({ tenantDebug: 'false' }))).toBe(true);
    });

    it('treats tenant apps_debug "1" as enabled', () => {
        setEnv({ NODE_ENV: 'staging' });

        expect(exposesDetails(validationBody({ tenantDebug: '1' }))).toBe(true);
    });

    it('never exposes details in production, even with APPS_DEBUG "true"', () => {
        setEnv({ NODE_ENV: 'production', APPS_ENVIRONMENT: 'production', APPS_DEBUG: 'true' });

        expect(exposesDetails(validationBody({ tenantDebug: 'true' }))).toBe(false);
    });

    it('never exposes details when only APPS_ENVIRONMENT marks production', () => {
        setEnv({ NODE_ENV: 'development', APPS_ENVIRONMENT: 'prod', APPS_DEBUG: 'true' });

        expect(exposesDetails(validationBody({ tenantDebug: 'true' }))).toBe(false);
    });

    it('never exposes details when the runtime is undeclared', () => {
        setEnv({ APPS_DEBUG: 'true' });

        expect(exposesDetails(validationBody({ tenantDebug: 'true' }))).toBe(false);
    });

    it('suppresses details when neither APPS_DEBUG nor tenant debug are enabled', () => {
        setEnv({ NODE_ENV: 'staging' });

        expect(exposesDetails(validationBody({ tenantDebug: 'false' }))).toBe(false);
    });
});
