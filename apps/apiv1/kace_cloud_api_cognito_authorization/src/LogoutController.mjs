import { BaseController, HttpResponse } from '@kace/api-common';
import { KnexAuthCognitoRepository } from '@kace/core/src/auth-cognito/infraestructure/KnexAuthCognitoRepository.js';
import { Helper } from '@kace/core/src/shared/index.js';
import { logoutSchema } from './schemas.mjs';
import { LogoutUser } from '@kace/core/src/auth-cognito/application/LogoutUser.js';

export default class LogoutController extends BaseController {
    #cryptoParams; /** Is initialized in the constructor */

    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexAuthCognitoRepository(knexConfig);
        this.started_at = new Date();
        this.#cryptoParams = {
            secret_key: event.tenantContext.tenant.secret_key.value,
            secret_iv: event.tenantContext.tenant.secret_iv.value,
            encryption_method: event.tenantContext.tenant.encryption_method.value,
        };
    }

    async destroyDbConnection() {
        await super.destroyDbConnection();
        await this.repository.destroyConnection();
    }

    async actionCreate() {
        Helper.logInfo('Begin actionLogout');
        const payload = this.payload();
        payload.client_id = this.event.tenantContext.tenant.aws_cognito_app_client_id.value;
        payload.id_token = this.getHeader('authorization');

        const data = logoutSchema.validate(payload, { abortEarly: false });
        if (data.error) {
            return HttpResponse.validationsFail({
                errors: data.error,
                event: this.event,
            });
        }

        try {
            const logoutService = new LogoutUser(payload, this.repository, this.#cryptoParams);
            const result = await logoutService.execute();

            return HttpResponse.ok({
                ...result,
                event: this.event,
            });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({ message: error.message, event: this.event });
        } finally {
            Helper.logInfo('End actionLogout');
        }
    }
}
