import { jest } from '@jest/globals';

// --- Mock all heavy infrastructure so BaseController can be instantiated without a real DB ---

let mockGroupConfigServiceExecute;

jest.unstable_mockModule('@kace/core/src/global-config/index.js', () => {
    const executeMock = jest.fn();
    mockGroupConfigServiceExecute = executeMock;

    return {
        GlobalConfigurations: class GlobalConfigurations {},
        GroupConfigService: jest.fn().mockImplementation(() => ({
            execute: executeMock,
        })),
        KnexGlobalConfigurationRepository: jest.fn().mockImplementation(() => ({})),
    };
});

jest.unstable_mockModule('@kace/core/src/users/index.js', () => ({
    KnexUsersRepository: jest.fn().mockImplementation(() => ({
        connection: {},
        destroyConnection: jest.fn().mockResolvedValue(undefined),
    })),
    User: class User {},
    UserLoginFinder: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/grupos/index.js', () => ({
    KnexGroupsRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@kace/core/src/shared/index.js', () => {
    class CustomError extends Error {
        constructor(message, code) {
            super(message);
            this.code = code;
        }
    }
    class DomainError extends Error {
        constructor(message, code) {
            super(message);
            this.code = code;
        }
    }
    class ValidationFailError extends Error {
        constructor(message, code) {
            super(message);
            this.code = code;
        }
    }
    class QueryDBError extends Error {
        constructor(message, code) {
            super(message);
            this.code = code;
        }
    }
    return {
        AccountTypeEnum: {},
        CustomError,
        DomainError,
        EventPublisher: jest.fn().mockImplementation(() => ({})),
        Helper: {
            logInfo: jest.fn(),
            logError: jest.fn(),
            logDebug: jest.fn(),
        },
        KnexRepository: jest.fn().mockImplementation(() => ({
            connection: {},
        })),
        QueryDBError,
        SecurePasswordEncoder: {},
        ValidationFailError,
        // Additional named exports used by transitive imports (e.g. Response.js)
        ValueObjectUuid: jest.fn(),
    };
});

jest.unstable_mockModule('@kace/core/src/shared/infrastructure/events/buildRoutingEventBusFromTenant.js', () => ({
    buildRoutingEventBusFromTenant: jest.fn().mockReturnValue({}),
}));

jest.unstable_mockModule('@kace/core/src/shared/infrastructure/events/InMemoryEventBus.js', () => ({
    InMemoryEventBus: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('aws-jwt-verify', () => ({
    CognitoJwtVerifier: {
        create: jest.fn().mockReturnValue({
            verify: jest.fn(),
        }),
    },
}));

jest.unstable_mockModule('@kace/core/src/auth-cognito/index.js', () => ({
    KnexAuthCognitoRepository: jest.fn().mockImplementation(() => ({})),
}));

jest.unstable_mockModule('@kace/core/src/shared/errors/AuthFailError.js', () => ({
    default: class AuthFailError extends Error {
        constructor(message, code, errorCode) {
            super(message);
            this.code = code;
            this.errorCode = errorCode;
        }
    },
}));

// Other imports BaseController uses at module level
jest.unstable_mockModule('@kace/error-codes', () => ({
    AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
    AUTH_FINGERPRINT_MISMATCH: 'AUTH_FINGERPRINT_MISMATCH',
    AUTH_GET_TOKEN_CLAIMS: 'AUTH_GET_TOKEN_CLAIMS',
    AUTH_NOT_USER_AUTHENTICATED: 'AUTH_NOT_USER_AUTHENTICATED',
    AUTH_SESSION_COOKIE_STALE: 'AUTH_SESSION_COOKIE_STALE',
    AUTH_SESSION_KEY_MISMATCH: 'AUTH_SESSION_KEY_MISMATCH',
    AUTH_USER_INACTIVE: 'AUTH_USER_INACTIVE',
    AUTH_USER_NOT_FOUND: 'AUTH_USER_NOT_FOUND',
    BAD_REQUEST_ERROR: 'BAD_REQUEST_ERROR',
    CONFLICT_ERROR: 'CONFLICT_ERROR',
    DATABASE_ERROR: 'DATABASE_ERROR',
    GENERAL_INTERNAL_ERROR: 'GENERAL_INTERNAL_ERROR',
    METHOD_NOT_ALLOWED_ERROR: 'METHOD_NOT_ALLOWED_ERROR',
    NOT_FOUND_ERROR: 'NOT_FOUND_ERROR',
    REQUEST_TIMEOUT_ERROR: 'REQUEST_TIMEOUT_ERROR',
    TENANT_CONTEXT_ERROR: 'TENANT_CONTEXT_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
}));

jest.unstable_mockModule('@kace/core/src/shared/domain/params/Parameters.js', () => ({
    Parameters: { oneScriptUrlReferer: 'http://localhost' },
}));

jest.unstable_mockModule('@kace/core/src/shared/domain/services/AdvancedSearch.js', () => ({
    AdvancedSearch: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/actions/index.js', () => ({
    KnexActionRepository: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/classifications/index.js', () => ({
    KnexClassificationRepository: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/templates/index.js', () => ({
    KnexTemplatesRepository: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/action-update-model/index.js', () => ({
    KnexActionUpdateModelRepository: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/mail-accounts/index.js', () => ({
    KnexMailAccountRepository: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/ws-rest-flows/index.js', () => ({
    KnexWSRestFlowRepository: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/clients/index.js', () => ({
    KnexClientRepository: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/aux_clientes/index.js', () => ({
    KnexAuxClientsRepository: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/aux_casos/index.js', () => ({
    KnexAuxCasesRepository: jest.fn(),
}));

jest.unstable_mockModule(
    '@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js',
    () => ({
        KnexSecretsVaultRepository: jest.fn(),
    })
);

jest.unstable_mockModule('@kace/core/src/allowed-conections/index.js', () => ({
    KnexAllowedConnectionsRepository: jest.fn(),
}));

jest.unstable_mockModule(
    '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js',
    () => ({
        KnexWSRestWorkflowStepRepository: jest.fn(),
    })
);

jest.unstable_mockModule('@kace/core/src/cases/index.js', () => ({
    KnexSubcaseRelationshipRepository: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/shared/domain/services/ActionExecutor.js', () => ({
    ActionExecutor: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/actions/domain/ActionExecutionDomainService.js', () => ({
    ActionExecutionDomainService: jest.fn(),
}));

jest.unstable_mockModule('@kace/core/src/user-lists/index.js', () => ({
    KnexUserListsRepository: jest.fn(),
}));

// --- Load module under test AFTER all mocks are registered ---
const { BaseController } = await import('../../src/controllers/BaseController.js');

// Import the mocked User class so we can create instances that pass the instanceof check in the setter
const { User } = await import('@kace/core/src/users/index.js');

// --- Helpers ---

/**
 * Build a minimal event + knexConfig that satisfies BaseController's constructor
 * without touching real infrastructure.
 */
function buildMinimalEvent() {
    return {
        httpMethod: 'GET',
        resource: '/',
        headers: {
            Authorization: 'test-token',
            Host: 'localhost',
        },
        body: '{}',
        tenantContext: {
            tenant: {
                id: { value: 'tenant-1' },
                aws_cognito_user_pool_id: { value: 'us-east-1_TESTPOOL' },
                aws_cognito_app_client_id: { value: 'test-client-id' },
            },
        },
    };
}

function buildMinimalKnexConfig() {
    return { client: 'pg', connection: {} };
}

function buildFakeUser() {
    // Must be an instance of the mocked User class so the setter's instanceof check passes
    return new User();
}

function buildAuthenticatedController() {
    const controller = new BaseController(buildMinimalEvent(), buildMinimalKnexConfig());
    // Set a User instance to satisfy the instanceof check in the setter
    controller.user = buildFakeUser();
    return controller;
}

// --- Tests ---

describe('BaseController.getGlobalConfig – memoization', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Make execute return a resolved promise with a dummy config each time it is called
        mockGroupConfigServiceExecute.mockResolvedValue({ id: 'config-1' });
    });

    it('calls GroupConfigService.execute only once even when awaited twice', async () => {
        const controller = buildAuthenticatedController();

        const result1 = await controller.getGlobalConfig();
        const result2 = await controller.getGlobalConfig();

        expect(mockGroupConfigServiceExecute).toHaveBeenCalledTimes(1);
        expect(result1).toStrictEqual(result2);
    });

    it('concurrent calls resolve to the same value and trigger execute only once', async () => {
        const controller = buildAuthenticatedController();

        // Fire both calls concurrently (before either has resolved) to exercise the
        // race-condition guard: the second call must reuse the cached promise, not
        // fire a second execute().
        const [result1, result2] = await Promise.all([controller.getGlobalConfig(), controller.getGlobalConfig()]);

        expect(mockGroupConfigServiceExecute).toHaveBeenCalledTimes(1);
        expect(result1).toStrictEqual(result2);
    });

    it('cachea una promesa rechazada: llamadas posteriores en la misma instancia rechazan sin re-ejecutar', async () => {
        mockGroupConfigServiceExecute.mockRejectedValue(new Error('DB error'));
        const controller = buildAuthenticatedController();

        await expect(controller.getGlobalConfig()).rejects.toThrow('DB error');
        await expect(controller.getGlobalConfig()).rejects.toThrow('DB error');
        expect(mockGroupConfigServiceExecute).toHaveBeenCalledTimes(1);
    });

    it('two controllers have independent caches (one call per controller)', async () => {
        const controllerA = buildAuthenticatedController();
        const controllerB = buildAuthenticatedController();

        await controllerA.getGlobalConfig();
        await controllerA.getGlobalConfig(); // second call — should NOT trigger another execute

        await controllerB.getGlobalConfig(); // first call on a different instance — SHOULD trigger execute

        // controllerA: 1 execute; controllerB: 1 execute → total 2
        expect(mockGroupConfigServiceExecute).toHaveBeenCalledTimes(2);
    });
});

describe('BaseController.getGlobalConfig – auth guard', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockGroupConfigServiceExecute.mockResolvedValue({ id: 'config-1' });
    });

    it('throws when user is not set (unauthenticated)', async () => {
        const controller = new BaseController(buildMinimalEvent(), buildMinimalKnexConfig());
        // No user set — controller.user stays null

        await expect(controller.getGlobalConfig()).rejects.toThrow(
            'User must be authenticated to access global config'
        );
    });

    it('does NOT cache on an unauthenticated call — a subsequent authenticated call still executes', async () => {
        const controller = new BaseController(buildMinimalEvent(), buildMinimalKnexConfig());

        // First call: no user → must throw
        await expect(controller.getGlobalConfig()).rejects.toThrow();

        // Now authenticate the controller (must pass instanceof User check in the setter)
        controller.user = buildFakeUser();

        // Second call: user is set → must succeed and execute exactly once
        await controller.getGlobalConfig();

        expect(mockGroupConfigServiceExecute).toHaveBeenCalledTimes(1);
    });
});
