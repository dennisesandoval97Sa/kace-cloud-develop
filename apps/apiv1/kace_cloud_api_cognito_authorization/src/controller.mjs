import { AuthenticationUser } from '@kace/core/src/auth-cognito/application/authentication-user/AuthenticationUser.js';
import { buildSetCookieHeader } from '@kace/core/src/auth-cognito/domain/SessionCookieService.js';
import { createSchema, schemaServiceAccount } from './schemas.mjs';
import { BaseController, HttpResponse } from '@kace/api-common';
import { KnexAuthCognitoRepository } from '@kace/core/src/auth-cognito/infraestructure/KnexAuthCognitoRepository.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { AuthServiceAccount } from '@kace/core/src/auth-cognito/application/AuthServiceAccount.js';
import { IdpCognito } from '@kace/core/src/auth-cognito/infraestructure/idps/IdpCognito.js';
import { Parameters } from '@kace/core/src/shared/domain/params/Parameters.js';

export class Controller extends BaseController {
    /** @type {IdpCognito} */
    #idp; // is initialized in the constructor
    #cryptoParams; /** Is initialized in the constructor */

    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexAuthCognitoRepository(this.database_connection);
        this.started_at = new Date();
        this.#idp = new IdpCognito({
            region: event.tenantContext.tenant.aws_cognito_region.value,
            clientId: event.tenantContext.tenant.aws_cognito_app_client_id.value,
        });
        this.#cryptoParams = {
            secret_key: event.tenantContext.tenant.secret_key.value,
            secret_iv: event.tenantContext.tenant.secret_iv.value,
            encryption_method: event.tenantContext.tenant.encryption_method.value,
        };
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        const payload = this.payload();

        try {
            if (payload?.id_token) {
                try {
                    await this.validateBodyTokenExpiration();
                } catch (error) {
                    Helper.logInfo('Error validating id_token expiration', error);
                    return HttpResponse.unauthorized({
                        message: error.message || 'Invalid Token',
                        event: this.event,
                    });
                }
                return await this.loginUserAccount(payload);
            }

            if (payload?.username && payload?.password) {
                return await this.loginServiceAccount(payload);
            }
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }

    async loginUserAccount(payload) {
        payload.created_at = this.started_at;
        payload.clientFingerprint = this.getHeader('x-client-fingerprint');

        const data = createSchema.validate(payload, { abortEarly: false });
        if (data.error) {
            return HttpResponse.validationsFail({
                errors: data.error,
                event: this.event,
            });
        }

        try {
            payload.sourceIp = this.event.requestContext.identity.sourceIp;
            const refererIsOneScript = this.getHeader('referer') === Parameters.oneScriptUrlReferer;
            const sessionKeyCookie = this.getCookie('session_key');

            const response = await new AuthenticationUser(payload, this.repository, this.#cryptoParams).execute(
                refererIsOneScript,
                sessionKeyCookie
            );
            let headers = {};
            if (response.user && response.user.account_type === 1 && refererIsOneScript === false) {
                const sameSite =
                    this.event.tenantContext.tenant.apps_service_name.value === 'DEVELOPMENT' ? 'None' : 'LAX';
                headers['Set-Cookie'] = buildSetCookieHeader(response.user.session_key, sameSite);
            }
            return HttpResponse.ok({
                ...response.toJson(),
                event: this.event,
                headers,
            });
        } catch (error) {
            if (error.statusCode === 409) {
                return HttpResponse.conflict({
                    message: error.message,
                    data: { code: error.errorCode },
                    event: this.event,
                });
            }
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        }
    }

    async loginServiceAccount(payload) {
        payload.clientFingerprint = this.getHeader('x-client-fingerprint');
        const data = schemaServiceAccount.validate(payload, { abortEarly: false });
        if (data.error) {
            return HttpResponse.badRequest({
                message: 'Los datos enviados no son correctos',
                errors: data.error,
                event: this.event,
            });
        }

        try {
            const cognitoData = await new AuthServiceAccount(this.#idp).execute(payload);
            payload = {
                ...payload,
                id_token: cognitoData.IdToken,
                access_token: cognitoData.AccessToken,
                refresh_token: cognitoData.RefreshToken,
                expires_in: cognitoData.ExpiresIn,
                token_type: cognitoData.TokenType,
                sourceIp: this.event.requestContext.identity.sourceIp,
            };

            const response = await new AuthenticationUser(payload, this.repository, this.#cryptoParams).execute();

            const newResponse = {
                ...response.toJson(),
            };
            newResponse.data.id_token = cognitoData.IdToken;

            return HttpResponse.ok({ ...newResponse, event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        }
    }
}
