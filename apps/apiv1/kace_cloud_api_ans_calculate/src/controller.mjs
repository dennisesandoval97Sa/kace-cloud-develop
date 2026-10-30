import { createSchema } from './schemas.mjs';
import { BaseController, HttpResponse } from '@kace/api-common';
import { KnexCaseRepository } from '@kace/core/src/cases';
import { AnsCalculator } from '@kace/core/src/ans/index.js';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexCaseRepository(this.database_connection);
    }

    async actionCreate() {
        Helper.logInfo('Begin actionCreate');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'ans', 'AnsCalculate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to calculate this resource.',
                    event: this.event,
                });
            }

            const data = createSchema.validate(this.payload(), { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const result = await new AnsCalculator(this.repository).execute(data.value);
            return HttpResponse.created({
                ...result.toJson(),
                message: 'Success',
                event: this.event,
            });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCreate');
        }
    }
}
