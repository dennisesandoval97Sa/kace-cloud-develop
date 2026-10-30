import { validate as validateUuid } from 'uuid';
import { HttpResponse } from '../http_responses/HttpResponse';
import { ResourceNotFoundError } from '../errors/runtime/ResourceNotFoundError.js';
import { MethodNotAllowedError } from '../errors/runtime/MethodNotAllowedError.js';
import { KnexUsersRepository, User, UserLoginFinder } from '@kace/core/src/users/index.js';
import {
    GlobalConfigurations,
    GroupConfigService,
    KnexGlobalConfigurationRepository,
} from '@kace/core/src/global-config/index.js';
import { KnexGroupsRepository } from '@kace/core/src/grupos/index.js';
import {
    AccountTypeEnum,
    CustomError,
    EventPublisher,
    Helper,
    KnexRepository,
    SecurePasswordEncoder,
    ValidationFailError,
} from '@kace/core/src/shared/index.js';
import { buildRoutingEventBusFromTenant } from '@kace/core/src/shared/infrastructure/events/buildRoutingEventBusFromTenant.js';
import { InMemoryEventBus } from '@kace/core/src/shared/infrastructure/events/InMemoryEventBus.js';
import { readFileSync } from 'fs';
import path from 'path';
import { SearchSchema } from '../validation/schemas/SearchSchema.js';
import { AdvancedSearch } from '@kace/core/src/shared/domain/services/AdvancedSearch.js';
import { KnexActionRepository } from '@kace/core/src/actions/index.js';
import { KnexClassificationRepository } from '@kace/core/src/classifications/index.js';
import { KnexTemplatesRepository } from '@kace/core/src/templates/index.js';
import { KnexActionUpdateModelRepository } from '@kace/core/src/action-update-model/index.js';
import { KnexMailAccountRepository } from '@kace/core/src/mail-accounts/index.js';
import { KnexWSRestFlowRepository } from '@kace/core/src/ws-rest-flows/index.js';
import { KnexClientRepository } from '@kace/core/src/clients/index.js';
import { KnexAuxClientsRepository } from '@kace/core/src/aux_clientes/index.js';
import { KnexAuxCasesRepository } from '@kace/core/src/aux_casos/index.js';
import { KnexSecretsVaultRepository } from '@kace/core/src/secrets-vault/infrastructure/persistence/KnexSecretsVaultRepository.js';
import { KnexAllowedConnectionsRepository } from '@kace/core/src/allowed-conections/index.js';
import { KnexWSRestWorkflowStepRepository } from '@kace/core/src/ws-rest-workflow-step/infrastructure/persistence/KnexWSRestWorkflowStepRepository.js';
import { KnexSubcaseRelationshipRepository } from '@kace/core/src/cases/index.js';
import { ActionExecutor } from '@kace/core/src/shared/domain/services/ActionExecutor.js';
import { ActionExecutionDomainService } from '@kace/core/src/actions/domain/ActionExecutionDomainService.js';
import { KnexAuthCognitoRepository } from '@kace/core/src/auth-cognito/index.js';
import { CognitoJwtVerifier } from 'aws-jwt-verify';
import { KnexUserListsRepository } from '@kace/core/src/user-lists/index.js';
import AuthFailError from '@kace/core/src/shared/errors/AuthFailError.js';
import {
    AUTH_FINGERPRINT_MISMATCH,
    AUTH_GET_TOKEN_CLAIMS,
    AUTH_NOT_USER_AUTHENTICATED,
    AUTH_SESSION_COOKIE_STALE,
    AUTH_USER_INACTIVE,
    AUTH_USER_NOT_FOUND,
} from '@kace/error-codes';
import { Parameters } from '@kace/core/src/shared/domain/params/Parameters.js';
import {
    buildSetCookieHeader,
    generateSessionKey,
    resolveSessionKey,
} from '@kace/core/src/auth-cognito/domain/SessionCookieService.js';
import { normalizeHeaders } from '../utils/normalizeHeaders.js';

export class BaseController {
    #event; // is initialized in the constructor
    /** @type {User|null} is initialized in the constructor */
    #user = null;
    /** @type {GlobalConfigurations|null} is initialized in the constructor */
    #globalConfiguration = null;
    /** @type {Promise<GlobalConfigurations>|null} memoized promise for getGlobalConfig (one DB round-trip per request) */
    #globalConfigPromise = null;
    /** @type {Object} */
    #knexConfig; // is initialized in the constructor
    /** @type {KnexUsersRepository} */
    #userRepository; // is initialized in the constructor
    /** @type {KnexGroupsRepository} */
    #groupsRepository; // is initialized in the constructor
    /** @type {KnexGlobalConfigurationRepository} */
    #globalConfigurationRepository; // is initialized in the constructor
    /** @type {KnexRepository} */
    #repository; // is initialized in the constructor
    /** @type {KnexAuthCognitoRepository} */
    #tokensRepository;
    /** @type {CognitoJwtVerifier} */
    #cognitoJwtVerifier;
    /** @type {Tenant} */
    #tenant;
    /** @type {Object<string, string>} */
    #cookies;
    #eventPublisher; // is initialized in the constructor
    get eventPublisher() {
        return this.#eventPublisher;
    }

    constructor(event, knexConfig) {
        if (!event || !knexConfig) {
            Helper.logError('BaseController:ensureInitialValuesAreValid event and knexConfig are required');
            throw new ValidationFailError('Initial configuration is required', 500);
        }

        this.event = event;
        this.#knexConfig = knexConfig;
        this.#tenant = event.tenantContext.tenant;
        this.#repository = new KnexRepository(this.#knexConfig);
        this.#userRepository = new KnexUsersRepository(this.#repository.connection);
        this.#groupsRepository = new KnexGroupsRepository(this.#repository.connection);
        this.#globalConfigurationRepository = new KnexGlobalConfigurationRepository(this.#repository.connection);
        this.#tokensRepository = new KnexAuthCognitoRepository(this.#repository.connection);
        this.#cognitoJwtVerifier = CognitoJwtVerifier.create({
            userPoolId: this.#tenant.aws_cognito_user_pool_id.value,
            tokenUse: 'id',
            clientId: this.#tenant.aws_cognito_app_client_id.value,
        });
        this.#cookies = this.#getCookies();
        this.#eventPublisher = this.#buildEventPublisher();
    }

    /**
     *
     * @returns {User|null}
     */
    get user() {
        return this.#user;
    }

    set user(value) {
        if (value !== null && !(value instanceof User)) {
            throw new Error('Invalid user');
        }
        this.#user = value;
    }

    /**
     *
     * @returns {GlobalConfigurations|null}
     */
    get globalConfiguration() {
        return this.#globalConfiguration;
    }

    set globalConfiguration(value) {
        if (value !== null && !(value instanceof GlobalConfigurations)) {
            throw new Error('Invalid GlobalConfiguration');
        }
        this.#globalConfiguration = value;
    }

    async verifyJwt(token) {
        try {
            return await this.#cognitoJwtVerifier.verify(token);
        } catch (error) {
            Helper.logError('JWT verification failed', error);
            throw new CustomError('Invalid token', 401);
        }
    }

    /**
     *
     * @returns {User}
     */
    async getLoggedInUser() {
        const claims = await this.getTokenClaims();
        if (!claims) {
            Helper.logInfo('BaseController::getLoggedInUser fail.');
            Helper.logDebug(`BaseController::getLoggedInUser claims: ${claims}`);
            throw new AuthFailError('The credentials do not match our records.', 401, AUTH_GET_TOKEN_CLAIMS);
        }

        await this.validateBodyTokenExpiration();

        const fingerprint = this.getHeader('x-client-fingerprint');

        const finder = new UserLoginFinder(this.#userRepository);
        const user = await finder.execute(claims.sub);

        if (!user) {
            Helper.logInfo('user not found, login:', claims.sub);
            throw new AuthFailError('The credentials do not match our records.', 401, AUTH_USER_NOT_FOUND);
        }

        if (!user.isActive()) {
            Helper.logInfo('user is not active, login:', claims.sub);
            throw new AuthFailError('This user is not active.', 400, AUTH_USER_INACTIVE);
        }

        const storedFingerprint = user?.cognito_hash_data?.value;

        if (user.account_type.equals(AccountTypeEnum.ACTIVE_DIRECTORY.value) && fingerprint !== storedFingerprint) {
            Helper.logInfo('fingerprint mismatch for login:', claims.sub);
            throw new AuthFailError(
                'Fingerprint conflict: another session is already active.',
                401,
                AUTH_FINGERPRINT_MISMATCH
            );
        }

        const isActiveDirectoryAccount = user.account_type.equals(AccountTypeEnum.ACTIVE_DIRECTORY.value);

        if (isActiveDirectoryAccount && this.getHeader('referer') !== Parameters.oneScriptUrlReferer) {
            const sessionKey = user.session_key?.value ?? null;
            const sessionKeyCookie = this.#cookies['session_key'] || null;
            if (sessionKeyCookie !== sessionKey) {
                Helper.logInfo('sessionKey mismatch detail', {
                    hasCookie: sessionKeyCookie !== null,
                    cookiePrefix: sessionKeyCookie ? sessionKeyCookie.slice(0, 8) : 'NULL',
                    storedPrefix: sessionKey ? sessionKey.slice(0, 8) : 'EMPTY',
                    sub: user.login?.value ?? 'unknown',
                });
                throw new AuthFailError('session cookie stale', 401, AUTH_SESSION_COOKIE_STALE);
            }
        }

        const host = this.getHeader('host') ?? '';
        const isLocalHost = host.includes('localhost') || host.includes('127.0.0.1');

        if (!isLocalHost && isActiveDirectoryAccount) {
            await this.verifySessionHash(user.session_id.value, claims, user);
        }

        return user;
    }

    /**
     * Retrieves the global configuration for the authenticated user.
     * @returns {Promise<GlobalConfigurations>}
     * @throws {AuthFailError} If the user is not authenticated.
     * @throws {CustomError} If a required group-related condition is not met.
     */
    async getGlobalConfig() {
        if (!this.user) {
            Helper.logInfo('BaseController::getGlobalConfig fail.');
            throw new AuthFailError(
                'User must be authenticated to access global config',
                400,
                AUTH_NOT_USER_AUTHENTICATED
            );
        }

        if (!this.#globalConfigPromise) {
            const groupConfigService = new GroupConfigService(
                this.#groupsRepository,
                this.#globalConfigurationRepository
            );
            this.#globalConfigPromise = groupConfigService.execute(this.user);
        }

        return this.#globalConfigPromise;
    }

    /**
     *
     * @returns {Object}
     */
    payload() {
        return JSON.parse(this.#event.body);
    }

    httpMethod() {
        this.#methodIsAllowed(this.#event.httpMethod);
        return this.#event.httpMethod;
    }

    resource() {
        this.#resourceAllowed(this.#event.resource);
        return this.#event.resource;
    }

    pathParameters() {
        return this.#event.pathParameters;
    }

    /**
     * @returns {Promise<Response>}
     */
    async #actions() {
        let response;
        const resource = this.resource();
        const method = this.httpMethod();

        switch (method) {
            case 'GET':
                if (resource === '/') {
                    response = await this.actionIndex();
                } else if (resource === '/{id}') {
                    response = await this.actionRead();
                } else if (resource === '/{id}/delete') {
                    response = await this.actionDelete();
                } else if (resource === '/{id}/body') {
                    response = await this.actionReadBody();
                } else if (resource === '/search') {
                    response = await this.actionSearch();
                } else {
                    response = HttpResponse.notFound({
                        message: `Resource not found: ${resource}`,
                        event: this.event,
                    });
                }
                break;
            case 'POST':
                if (resource === '/') {
                    response = await this.actionCreate();
                } else if (resource === '/{id}') {
                    response = await this.actionUpdate();
                } else if (resource === '/search') {
                    response = await this.actionSearch();
                } else if (resource === '/advance-search') {
                    response = await this.actionAdvanceSearch();
                } else if (resource === '/{id}/history') {
                    response = await this.actionHistory();
                } else {
                    response = HttpResponse.notFound({
                        message: `Resource not found: ${resource}`,
                        event: this.event,
                    });
                }
                break;
            default:
                response = HttpResponse.methodNotAllowed({ event: this.event });
        }

        return response;
    }

    /**
     * @returns {Promise<Response>}
     */
    async run() {
        try {
            try {
                this.user = await this.getLoggedInUser();
            } catch (error) {
                Helper.logError('Error getLoggedInUser', error);
                return HttpResponse.badRequest({
                    message: error.message,
                    errors: error,
                    event: this.event,
                });
            }

            const actionsResult = await this.#actions();
            return await this.#attachSessionCookieIfNeeded(actionsResult);
        } finally {
            await this.destroyDbConnection();
        }
    }

    async #attachSessionCookieIfNeeded(response) {
        if (!response?.isSuccessful?.() || !this.user) {
            return response;
        }

        const isActiveDirectoryAccount = this.user.account_type.equals(AccountTypeEnum.ACTIVE_DIRECTORY.value);
        const refererIsOneScript = this.getHeader('referer') === Parameters.oneScriptUrlReferer;

        if (!isActiveDirectoryAccount || refererIsOneScript) {
            return response;
        }

        const existingKey = this.user.session_key?.value ?? null;
        if (!existingKey) {
            return response;
        }

        const rotatedAtRaw = this.user.session_key_rotated_at?.value ?? null;
        const rotatedAt = rotatedAtRaw ? new Date(rotatedAtRaw) : null;
        const { sessionKey, rotated } = resolveSessionKey({
            existingKey,
            rotatedAt,
            now: new Date(),
            forceNew: false,
            generateNew: generateSessionKey,
        });

        if (rotated) {
            const rotatedAtIso = new Date().toISOString();
            await this.#userRepository.table().where({ id: this.user.id.value }).update({
                session_key: sessionKey,
                session_key_rotated_at: rotatedAtIso,
                updated_at: new Date(),
                updated_by: this.user.id.value,
            });
            this.user.session_key = sessionKey;
            this.user.session_key_rotated_at = rotatedAtIso;
        }

        const sameSite = this.#tenant.apps_service_name.value === 'DEVELOPMENT' ? 'None' : 'LAX';
        response.addHeaders({
            'Set-Cookie': buildSetCookieHeader(sessionKey, sameSite),
        });

        return response;
    }

    async destroyDbConnection() {
        await this.#userRepository.destroyConnection();
    }

    async runCognitoAuth() {
        try {
            return await this.#actions();
        } catch (error) {
            Helper.logError(error);
            return HttpResponse.internalServerError({ errors: error, event: this.#event });
        }
    }

    async actionIndex() {
        return Promise.resolve(
            HttpResponse.internalServerError({
                message: 'Action "index" is not implemented yet',
                event: this.event,
            })
        );
    }

    async actionCreate() {
        return Promise.resolve(
            HttpResponse.internalServerError({
                message: 'Action "create" is not implemented yet',
                event: this.event,
            })
        );
    }

    async actionRead() {
        return Promise.resolve(
            HttpResponse.internalServerError({
                message: 'Action "read" is not implemented yet',
                event: this.event,
            })
        );
    }

    async actionReadBody() {
        return Promise.resolve(
            HttpResponse.internalServerError({
                message: 'Action "readBody" is not implemented yet',
                event: this.event,
            })
        );
    }

    async actionUpdate() {
        return Promise.resolve(
            HttpResponse.internalServerError({
                message: 'Action "update" is not implemented yet',
                event: this.event,
            })
        );
    }

    async actionDelete() {
        return Promise.resolve(
            HttpResponse.internalServerError({
                message: 'Action "delete" is not implemented yet',
                event: this.event,
            })
        );
    }

    async actionSearch() {
        return Promise.resolve(
            HttpResponse.internalServerError({
                message: 'Action "search" is not implemented yet',
                event: this.event,
            })
        );
    }

    async actionAdvanceSearch() {
        Helper.logInfo('Begin actionAdvanceSearch');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'users', 'UsersRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.#event,
                });
            }

            const payload = this.payload();
            const data = SearchSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({ errors: data.error, event: this.#event });
            }

            let path, envPath;
            if (this.#event.path.split('/').length > 2) {
                path = this.#event.path.split('/')[1];
            }

            if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
                envPath = process.env.AWS_LAMBDA_FUNCTION_NAME.split('lambda')[0];
            }
            const tableName = path ?? envPath;

            if (!tableName) {
                return HttpResponse.validationsFail({
                    message: 'Error getting a valid tableName in actionAdvanceSearch',
                    event: this.#event,
                });
            }

            const userSearcher = new AdvancedSearch(this.#repository);
            const response = await userSearcher.execute(data.value, tableName);

            return HttpResponse.ok({ ...response, event: this.#event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ errors: error, event: this.#event });
        } finally {
            Helper.logInfo('End actionAdvanceSearch');
        }
    }

    async actionHistory() {
        return Promise.resolve(
            HttpResponse.internalServerError({
                message: 'Action "history" is not implemented yet',
                event: this.event,
            })
        );
    }

    #methodIsAllowed(method) {
        const allowMethods = ['GET', 'POST'];

        if (!allowMethods.includes(method)) {
            throw new MethodNotAllowedError();
        }
    }

    #resourceAllowed(resource) {
        const allowResources = [
            '/',
            '/{id}',
            '/{id}/body',
            '/search',
            '/{id}/delete',
            '/{id}/history',
            '/advance-search',
        ];

        if (!allowResources.includes(resource)) {
            throw new ResourceNotFoundError();
        }
    }

    /**
     *
     * @param {string} id
     * @returns {boolean}
     */
    validateId(id) {
        return validateUuid(id);
    }

    /**
     *
     * @returns {{sub,email}|null}
     */
    async getTokenClaims() {
        const token = this.getHeader('authorization');
        if (!token) return null;

        return await this.verifyJwt(token);
    }

    getVersion() {
        const packageJsonPath = path.join(process.cwd(), 'package.json');
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));

        return packageJson.version;
    }

    /**
     * Validates the session hash and self-heals legacy sessions on mismatch.
     * @param expectedHash
     * @param {Object} claims - Claims del token JWT
     * @param {User} [user] - The authenticated user; required for the self-heal path
     */
    async verifySessionHash(expectedHash, claims, user = this.user) {
        this.#assertClientFingerprintHeader();

        if (expectedHash === null || expectedHash === undefined) {
            throw new CustomError('Session verification failed', 401);
        }

        const clientFingerprint = this.getHeader('x-client-fingerprint');
        const rawSessionString = `${claims.email}:${claims.sub}:${clientFingerprint}`;
        const isValidSession = SecurePasswordEncoder.verifyPassword(rawSessionString, expectedHash);

        if (isValidSession) {
            return;
        }

        Helper.logInfo('Session hash mismatch, regenerating (one-time post-migration)', {
            sub: claims.sub,
        });

        if (!user) {
            throw new CustomError('Session verification failed', 401);
        }

        const newHash = SecurePasswordEncoder.createHash(rawSessionString);
        await this.#userRepository.table().where({ id: user.id.value }).update({
            session_id: newHash,
            updated_at: new Date(),
            updated_by: user.id.value,
        });
    }

    #assertClientFingerprintHeader() {
        const fingerprint = this.getHeader('x-client-fingerprint');

        if (!fingerprint || fingerprint.trim() === '') {
            throw new CustomError('Missing required HTTP header: X-Client-Fingerprint', 400);
        }

        const isValid = /^[a-zA-Z0-9_-]+$/.test(fingerprint);

        if (!isValid) {
            throw new CustomError(
                'Invalid X-Client-Fingerprint format. Only alphanumeric characters, hyphens, and underscores are allowed.',
                400
            );
        }
    }

    async validateBodyTokenExpiration() {
        let body;
        let token;
        let claims;

        try {
            body = JSON.parse(this.#event.body);
            token = body?.id_token || this.getHeader('authorization');
            claims = await this.verifyJwt(token);
        } catch (error) {
            Helper.logError(error);
            if (error instanceof CustomError) {
                throw error;
            }
            throw new CustomError('Invalid JSON body or token structure', 401);
        }

        if (!token) {
            throw new CustomError('id_token is required in request body', 401);
        }

        if (!claims?.exp) {
            throw new CustomError('Invalid token: missing exp field', 401);
        }

        const compensation = 3000; // 3 second compensation for clock skew
        const now = Math.floor(Date.now() / 1000) - compensation;
        if (claims.exp < now) {
            throw new CustomError('Expired token', 401);
        }

        if (await this.#tokensRepository.isTokenRevoked(token)) {
            throw new CustomError('Token revoked', 401);
        }

        return claims;
    }

    getActionExecutionService(repository) {
        const actionRepository = new KnexActionRepository(repository.connection);
        const usersRepository = new KnexUsersRepository(repository.connection);
        const grouRepository = new KnexGroupsRepository(repository.connection);
        const classificationRepository = new KnexClassificationRepository(repository.connection);
        const templatesRepository = new KnexTemplatesRepository(repository.connection);
        const mailAccountRepository = new KnexMailAccountRepository(repository.connection);
        const actionUpdateModelRepository = new KnexActionUpdateModelRepository(repository.connection);
        const wsRestFlowRepository = new KnexWSRestFlowRepository(repository.connection);
        const globalConfigurationRepository = new KnexGlobalConfigurationRepository(repository.connection);
        const clientRepository = new KnexClientRepository(repository.connection);
        const auxCasesRepository = new KnexAuxCasesRepository(repository.connection);
        const auxClientsRepository = new KnexAuxClientsRepository(repository.connection);
        const secretRepository = new KnexSecretsVaultRepository(repository.connection);
        const allowedConnectionsRepository = new KnexAllowedConnectionsRepository(repository.connection);
        const wsRestWorkflowStepRepository = new KnexWSRestWorkflowStepRepository(repository.connection);
        const subcaseRelationshipRepository = new KnexSubcaseRelationshipRepository(repository.connection);
        const userListRepository = new KnexUserListsRepository(repository.connection);

        const executor = new ActionExecutor(
            repository,
            usersRepository,
            grouRepository,
            classificationRepository,
            templatesRepository,
            mailAccountRepository,
            actionUpdateModelRepository,
            wsRestFlowRepository,
            globalConfigurationRepository,
            clientRepository,
            auxCasesRepository,
            auxClientsRepository,
            secretRepository,
            allowedConnectionsRepository,
            wsRestWorkflowStepRepository,
            subcaseRelationshipRepository,
            userListRepository
        );
        return new ActionExecutionDomainService(actionRepository, executor, repository);
    }

    get event() {
        return this.#event;
    }

    set event(value) {
        this.#event = { ...value, headers: normalizeHeaders(value?.headers) };
    }

    getCookie(name) {
        return this.#cookies[name] ?? null;
    }

    getHeader(name) {
        return this.#event.headers[name.toLowerCase()] ?? null;
    }

    get tenant() {
        return this.#tenant;
    }

    get database_connection() {
        return this.#repository.connection;
    }

    /**
     * Parses cookies from the request headers
     * @returns {Object<string, string>} Dictionary of cookie key-value pairs
     */
    #getCookies() {
        const cookieHeader = this.getHeader('cookie') ?? '';
        const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
            const trimmed = cookie.trim();
            const eqIdx = trimmed.indexOf('=');
            if (eqIdx === -1) return acc;
            const key = trimmed.slice(0, eqIdx).trim();
            const value = trimmed.slice(eqIdx + 1);
            if (key) acc[key] = value;
            return acc;
        }, {});

        return cookies;
    }

    /**
     * Builds an EventPublisher configured with a RoutingEventBus that routes
     * events to per-event-type SQS queues and archives to EventBridge.
     *
     * Uses tenant-specific AWS configuration via buildRoutingEventBusFromTenant.
     * Falls back to a no-op InMemoryEventBus when the tenant is missing required
     * AWS configuration fields, so a misconfigured tenant does not cause a total
     * API outage for all other requests.
     *
     * @returns {EventPublisher} Publisher ready to emit domain events (or no-op if tenant is misconfigured)
     */
    #buildEventPublisher() {
        try {
            const routingBus = buildRoutingEventBusFromTenant(this.tenant);
            return new EventPublisher(routingBus);
        } catch (error) {
            Helper.logError('BaseController: event publishing disabled (tenant misconfigured)', {
                tenantId: this.tenant?.id?.value,
                reason: error.message,
                stack: error.stack,
            });
            return new EventPublisher(new InMemoryEventBus());
        }
    }
}
