import { RelationsGetEntities } from '@kace/core/src/shared/domain/services/relations/RelationsGetEntities';
import { BaseController, HttpResponse } from '@kace/api-common';
import { RelationsRepository } from '@kace/core/src/shared/infrastructure/relations/RelationsRepository';
import { Helper } from '@kace/core/src/shared';
import { RelationsGetByEntityService } from '@kace/core/src/shared/domain/services/relations/RelationsGetByEntityService';
import { KnexAuxDefinitionsRepository } from '@kace/core/src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository';

export default class ControllerBoardRelations extends BaseController {
    /**
     * @type {RelationsRepository}
     */
    #relationsRepositories;

    /**
     * @type {KnexAuxDefinitionsRepository}
     */
    #auxDefinitionsRepository;

    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.#relationsRepositories = new RelationsRepository();
        this.#auxDefinitionsRepository = new KnexAuxDefinitionsRepository(this.database_connection);
    }

    async actionIndex() {
        Helper.logInfo('Begin BoardRelations actionIndex');

        try {
            const service = new RelationsGetEntities(this.#relationsRepositories, this.#auxDefinitionsRepository);

            const result = await service.execute();

            return HttpResponse.ok({
                data: result,
                event: this.event,
            });
        } catch (e) {
            Helper.logError(e);

            return HttpResponse.internalServerError({
                errors: e,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End BoardRelations actionIndex');
        }
    }

    actionRead() {
        Helper.logInfo('Begin BoardRelations actionRead');
        try {
            const entity = this.pathParameters().entity;
            if (!entity) {
                return HttpResponse.badRequest({
                    message: 'Invalid entity',
                    event: this.event,
                });
            }

            const service = new RelationsGetByEntityService(this.#relationsRepositories);

            const response = service.execute(entity);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (e) {
            Helper.logError(e);
            return HttpResponse.internalServerError({
                errors: e,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End BoardRelations actionRead');
        }
    }
}
