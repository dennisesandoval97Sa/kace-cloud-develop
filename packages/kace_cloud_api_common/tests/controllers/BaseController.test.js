import { Response, BaseController, MethodNotAllowedError, ResourceNotFoundError } from '../../src/index.js';
import { production } from '@kace/database';
import { UserFactory } from '@kace/core/src/factories/UserFactory.js';
import jwt from 'jsonwebtoken';
import { User } from '@kace/core/src/users/domain/User.js';
import { KnexUsersRepository, UserLoginFinder } from '@kace/core/src/users/index.js';
import { CustomError, PasswordEncoder, SecurePasswordEncoder, StatusEnum } from '@kace/core/src/shared/index.js';
import { Parameters } from '@kace/core/src/shared/domain/params/Parameters.js';
import { createRequire } from 'module';

describe('BaseController test', () => {
    const tokenExample =
        process.env.AWS_COGNITO_IDTOKEN ||
        jwt.sign(
            {
                sub: 'test-user-sub-id',
                email: 'test@example.com',
                'cognito:username': 'test-user',
            },
            'test-secret'
        );
    const headers = {
        Authorization: tokenExample,
    };
    const repository = new KnexUsersRepository(production);

    beforeAll(async () => {
        const decoded = jwt.decode(tokenExample);
        await repository.connection('usuarios').where({ login: decoded.sub }).delete();

        await new UserFactory(production).create({
            login: decoded.sub,
            email: decoded.email,
            is_active: StatusEnum.ACTIVE.value,
        });
    });

    it('should resolve the request method', async () => {
        const events = ['GET', 'POST'];

        events.map((event) => {
            const controller = new BaseController({ httpMethod: event, headers }, production);
            expect(controller.httpMethod()).toEqual(event);
        });
    });

    it('should throw error when the method is not available', async () => {
        const events = ['PUT', 'PATCH', 'OPTIONS', 'DELETE'];

        events.map((event) => {
            const controller = new BaseController({ httpMethod: event, headers }, production);
            expect(() => controller.httpMethod()).toThrow(MethodNotAllowedError);
        });
    });

    it('should resolve the request resource', async () => {
        const resources = ['/', '/{id}', '/search', '/{id}/delete'];

        resources.map((resource) => {
            const controller = new BaseController({ resource, headers }, production);
            expect(controller.resource()).toBe(resource);
        });
    });

    it('should throw error if the request resource doesnt exist', async () => {
        const resources = ['update', 'delete', 'invalid'];

        resources.map((resource) => {
            const controller = new BaseController({ resource, headers }, production);
            expect(() => controller.resource()).toThrow(ResourceNotFoundError);
        });
    });

    it('should call an action based on the request method and resource', async () => {
        const events = [
            { httpMethod: 'GET', resource: '/' },
            { httpMethod: 'GET', resource: '/{id}' },
            { httpMethod: 'GET', resource: '/search' },
            { httpMethod: 'POST', resource: '/' },
            { httpMethod: 'POST', resource: '/{id}' },
            { httpMethod: 'GET', resource: '/{id}/delete' },
        ];

        events.map(async (event) => {
            const controller = new BaseController({ ...event, headers }, production);
            const response = await controller.run();

            expect(response).toBeInstanceOf(Response);
        });
    });

    it('should resolve token claims', async () => {
        const event = {
            httpMethod: 'GET',
            resource: '/',
            headers: {
                Authorization: tokenExample,
            },
        };
        const controller = new BaseController(event, production);
        const claims = controller.getTokenClaims();

        expect(claims).toHaveProperty('sub');
        expect(claims).toHaveProperty('email');
    });

    it('should resolve the user from the token sub claim', async () => {
        const event = {
            httpMethod: 'GET',
            resource: '/',
            headers: {
                Authorization: tokenExample,
            },
        };

        const controller = new BaseController(event, production);

        const claims = controller.getTokenClaims();
        const rawSession = `${claims.email}:unknown:${claims.sub}:unknown`;
        await repository
            .connection('usuarios')
            .update({ session_id: PasswordEncoder.generateHash(rawSession) })
            .where({ login: claims.sub });

        const userLogged = await controller.getLoggedInUser();
        expect(userLogged).toBeInstanceOf(User);
    });

    it('should return the version from package.json', async () => {
        const require = createRequire(import.meta.url);
        const packageJson = require('../../package.json');

        const event = {
            httpMethod: 'GET',
            resource: '/',
            headers: {
                Authorization: tokenExample,
            },
        };
        const controller = new BaseController(event, production);

        const version = controller.getVersion();

        expect(version).toBe(packageJson.version);
    });

    describe('verifySessionHash tests', () => {
        const mockEmail = 'test@example.com';
        const mockSub = 'user123';
        const mockFingerprint = 'fp-stable-abc-123';

        function makeEvent({ fingerprint = mockFingerprint, sourceIp = '192.168.1.1' } = {}) {
            return {
                httpMethod: 'GET',
                resource: '/',
                headers: {
                    Authorization: tokenExample,
                    'X-Client-Fingerprint': fingerprint,
                },
                requestContext: {
                    identity: {
                        sourceIp,
                    },
                },
                tenantContext: {
                    tenant: {
                        aws_cognito_user_pool_id: { value: 'us-east-1_TEST' },
                        aws_cognito_app_client_id: { value: 'test-client-id' },
                        apps_service_name: { value: 'DEVELOPMENT' },
                    },
                },
            };
        }

        it('validates when stored hash matches new formula (no IP)', async () => {
            const validHash = SecurePasswordEncoder.createHash(`${mockEmail}:${mockSub}:${mockFingerprint}`);

            const controller = new BaseController(makeEvent(), production);
            await expect(
                controller.verifySessionHash(validHash, { email: mockEmail, sub: mockSub })
            ).resolves.not.toThrow();
        });

        it('does NOT reject when sourceIp changes (the bug fix)', async () => {
            const validHash = SecurePasswordEncoder.createHash(`${mockEmail}:${mockSub}:${mockFingerprint}`);

            const controller = new BaseController(makeEvent({ sourceIp: '203.0.113.99' }), production);
            await expect(
                controller.verifySessionHash(validHash, { email: mockEmail, sub: mockSub })
            ).resolves.not.toThrow();
        });

        it('self-heals when fingerprint changes (defense in earlier layers)', async () => {
            const validHash = SecurePasswordEncoder.createHash(`${mockEmail}:${mockSub}:${mockFingerprint}`);

            const controller = new BaseController(makeEvent({ fingerprint: 'attacker-fp' }), production);
            const claims = jwt.decode(tokenExample);
            const userInstance = await new UserLoginFinder(repository).execute(claims.sub);
            userInstance.session_id = validHash;

            await expect(
                controller.verifySessionHash(validHash, { email: mockEmail, sub: mockSub }, userInstance)
            ).resolves.not.toThrow();
        });

        it('self-heals when email changes (defense in earlier layers)', async () => {
            const validHash = SecurePasswordEncoder.createHash(`${mockEmail}:${mockSub}:${mockFingerprint}`);

            const controller = new BaseController(makeEvent(), production);
            const claims = jwt.decode(tokenExample);
            const userInstance = await new UserLoginFinder(repository).execute(claims.sub);
            userInstance.session_id = validHash;

            await expect(
                controller.verifySessionHash(validHash, { email: 'other@example.com', sub: mockSub }, userInstance)
            ).resolves.not.toThrow();
        });

        it('self-heals when sub changes (defense in earlier layers)', async () => {
            const validHash = SecurePasswordEncoder.createHash(`${mockEmail}:${mockSub}:${mockFingerprint}`);

            const controller = new BaseController(makeEvent(), production);
            const claims = jwt.decode(tokenExample);
            const userInstance = await new UserLoginFinder(repository).execute(claims.sub);
            userInstance.session_id = validHash;

            await expect(
                controller.verifySessionHash(validHash, { email: mockEmail, sub: 'other-user' }, userInstance)
            ).resolves.not.toThrow();
        });

        it('self-heals: regenerates session_id when stored hash uses legacy formula (with IP)', async () => {
            const event = makeEvent({ sourceIp: '203.0.113.99' });
            const controller = new BaseController(event, production);
            const claims = jwt.decode(tokenExample);

            const legacyHash = SecurePasswordEncoder.createHash(
                `${claims.email}:${claims.sub}:192.168.1.1:${mockFingerprint}`
            );

            await repository.connection('usuarios').where({ login: claims.sub }).update({ session_id: legacyHash });

            const userInstance = await new UserLoginFinder(repository).execute(claims.sub);

            await controller.verifySessionHash(legacyHash, claims, userInstance);

            const updated = await repository.connection('usuarios').where({ login: claims.sub }).first();

            expect(
                SecurePasswordEncoder.verifyPassword(
                    `${claims.email}:${claims.sub}:${mockFingerprint}`,
                    updated.session_id
                )
            ).toBe(true);
        });

        it('full flow: getLoggedInUser self-heals a legacy session_id without manually setting controller.user', async () => {
            const realClaims = jwt.decode(tokenExample);
            const sessionKey = 'sk-legacy-cookie-value-1234567890';

            const freshToken = jwt.sign(
                {
                    sub: realClaims.sub,
                    email: realClaims.email,
                    exp: Math.floor(Date.now() / 1000) + 3600,
                },
                'test-secret'
            );
            const claims = { sub: realClaims.sub, email: realClaims.email, exp: Math.floor(Date.now() / 1000) + 3600 };

            const legacyHash = SecurePasswordEncoder.createHash(
                `${claims.email}:${claims.sub}:192.168.1.1:${mockFingerprint}`
            );

            await repository.connection('usuarios').where({ login: claims.sub }).update({
                account_type: 1,
                cognito_hash_data: mockFingerprint,
                session_key: sessionKey,
                session_id: legacyHash,
            });

            const event = {
                httpMethod: 'GET',
                resource: '/',
                headers: {
                    Authorization: freshToken,
                    'X-Client-Fingerprint': mockFingerprint,
                    Host: 'example.com',
                    Cookie: `session_key=${sessionKey}`,
                },
                body: JSON.stringify({ id_token: freshToken }),
                requestContext: {
                    identity: {
                        sourceIp: '203.0.113.99',
                    },
                },
                tenantContext: {
                    tenant: {
                        aws_cognito_user_pool_id: { value: process.env.AWS_COGNITO_USER_POOL_ID },
                        aws_cognito_app_client_id: { value: process.env.AWS_COGNITO_APP_CLIENT_ID },
                        apps_service_name: { value: 'DEVELOPMENT' },
                    },
                },
            };

            const controller = new BaseController(event, production);
            const userLogged = await controller.getLoggedInUser();

            expect(userLogged).toBeInstanceOf(User);

            const updated = await repository.connection('usuarios').where({ login: claims.sub }).first();

            expect(
                SecurePasswordEncoder.verifyPassword(
                    `${claims.email}:${claims.sub}:${mockFingerprint}`,
                    updated.session_id
                )
            ).toBe(true);
        });
    });

    describe('session cookie check vs OneScript referer', () => {
        const mockFingerprint = 'fp-onescript-regression';

        async function setUpActiveDirectoryUser(sessionKey) {
            const realClaims = jwt.decode(tokenExample);
            const freshToken = jwt.sign(
                {
                    sub: realClaims.sub,
                    email: realClaims.email,
                    exp: Math.floor(Date.now() / 1000) + 3600,
                },
                'test-secret'
            );

            await repository
                .connection('usuarios')
                .where({ login: realClaims.sub })
                .update({
                    account_type: 1,
                    cognito_hash_data: mockFingerprint,
                    session_key: sessionKey,
                    session_id: SecurePasswordEncoder.createHash(
                        `${realClaims.email}:${realClaims.sub}:${mockFingerprint}`
                    ),
                });

            return freshToken;
        }

        function eventWithoutSessionCookie(token, referer) {
            return {
                httpMethod: 'GET',
                resource: '/',
                headers: {
                    Authorization: token,
                    'X-Client-Fingerprint': mockFingerprint,
                    Host: 'example.com',
                    ...(referer ? { Referer: referer } : {}),
                },
                body: JSON.stringify({ id_token: token }),
                requestContext: { identity: { sourceIp: '203.0.113.99' } },
                tenantContext: {
                    tenant: {
                        aws_cognito_user_pool_id: { value: process.env.AWS_COGNITO_USER_POOL_ID },
                        aws_cognito_app_client_id: { value: process.env.AWS_COGNITO_APP_CLIENT_ID },
                        apps_service_name: { value: 'DEVELOPMENT' },
                    },
                },
            };
        }

        it('does not throw AUTH_SESSION_COOKIE_STALE for a capitalized "Referer: onescript.konecta.cloud" and no session_key cookie', async () => {
            const freshToken = await setUpActiveDirectoryUser('sk-onescript-1234567890');
            const event = eventWithoutSessionCookie(freshToken, Parameters.oneScriptUrlReferer);
            const controller = new BaseController(event, production);

            await expect(controller.getLoggedInUser()).resolves.toBeInstanceOf(User);
        });

        it('(control) throws AUTH_SESSION_COOKIE_STALE for the same request without the OneScript referer', async () => {
            const freshToken = await setUpActiveDirectoryUser('sk-onescript-control-1234567890');
            const event = eventWithoutSessionCookie(freshToken, null);
            const controller = new BaseController(event, production);

            await expect(controller.getLoggedInUser()).rejects.toThrow('session cookie stale');
        });
    });
});
describe('validateBodyTokenExpiration tests', () => {
    const baseEvent = {
        httpMethod: 'POST',
        resource: '/',
        headers: {},
    };

    it('should pass when id_token is valid and not expired', () => {
        const validToken = jwt.sign(
            {
                sub: 'test-user',
                email: 'test@example.com',
                exp: Math.floor(Date.now() / 1000) + 60,
            },
            'dummy-secret'
        );

        const event = {
            ...baseEvent,
            body: JSON.stringify({ id_token: validToken }),
        };

        const controller = new BaseController(event, production);
        expect(() => controller.validateBodyTokenExpiration()).not.toThrow();
    });

    it('should throw CustomError when id_token is expired', () => {
        const expiredToken = jwt.sign(
            {
                sub: 'test-user',
                email: 'test@example.com',
                exp: Math.floor(Date.now() / 1000) - 60,
            },
            'dummy-secret'
        );

        const event = {
            ...baseEvent,
            body: JSON.stringify({ id_token: expiredToken }),
        };

        const controller = new BaseController(event, production);
        expect(() => controller.validateBodyTokenExpiration()).toThrow('Expired token');
    });
});
