import { BaseController, HttpResponse } from '@kace/api-common';
import { UserFinder, UserLoginFinder, UserLastSeenUpdater } from '@kace/core/src/users/index.js';
import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';
import jwt from 'jsonwebtoken';
import { sessionSchema } from './schemas.js';
import { KnexUsersRepository } from '@kace/core/src/users/infrastructure/KnexUsersRepository.js';

export default class ControllerSession extends BaseController {
    #decodedToken;
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexUsersRepository(this.database_connection);
        this.started_at = new Date();
        this.#decodedToken = jwt.decode(this.getHeader('authorization'));
    }

    async actionCreate() {
        Helper.logDebug('Begin actionSession');
        const payload = this.payload();
        let { user_id } = this.payload() ?? {};
        try {
            const hasPermission = this.user.hasPermission('administrador', 'users', 'UsersUpdate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                });
            }

            const data = sessionSchema.validate(payload, { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }
            if (!user_id) {
                const sub = this.#decodedToken?.sub;
                const finder = new UserLoginFinder(this.repository);
                const info = await finder.execute(sub);
                user_id = info?.id?.value;
            }

            if (!this.validateId(user_id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid user_id',
                    event: this.event,
                });
            }

            const userResponse = await new UserFinder(this.repository, this.user).execute(user_id);
            const userData = userResponse.toJson().data;

            if (String(userData.login) !== String(this.#decodedToken.sub)) {
                return HttpResponse.unauthorized({
                    message: 'Token subject does not match user',
                    event: this.event,
                });
            }

            await new UserLastSeenUpdater(this.repository).execute(user_id, this.user.id.value);
            return HttpResponse.ok({
                message: `Session updated for user ${user_id}`,
                event: this.event,
            });
        } catch (error) {
            Helper.logError('Error in actionSession', error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logDebug('End actionSession');
        }
    }
}
