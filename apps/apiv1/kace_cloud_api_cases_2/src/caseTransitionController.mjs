import { BaseController, HttpResponse } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';
import {
    KnexCaseRepository,
    CaseTransitionsUpdater,
    KnexTransitionsCaseRepository,
} from '@kace/core/src/cases/index.js';
import { KnexTransitionRuleRepository } from '@kace/core/src/transition-rules/infrastructure/KnexTransitionRuleRepository.js';
import { schemaTransitionUpdate } from './schemas.mjs';
import { CustomError } from '@kace/core/src/shared/errors/CustomError';
import { Controller } from './controller.mjs';

export class TransitionController extends BaseController {
    #actionExecutionService;

    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexCaseRepository(this.database_connection);
        this.transitionsRepository = new KnexTransitionsCaseRepository(this.database_connection);
        this.transitionRuleRepository = new KnexTransitionRuleRepository(this.database_connection);
        this.started_at = new Date();
        this.#actionExecutionService = new Controller(event, knexConfig).actionExecutionService;
    }

    async actionCreate() {
        Helper.logInfo('Begin TransitionUpdate');
        try {
            const hasPermission = this.user.hasPermission('agente', 'cases', 'CasesCreate');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to update this resource.',
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const payload = this.payload();
            const { value, error } = schemaTransitionUpdate.validate(payload, {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            if (value.transicion_id) {
                await this.#ensureTransitionRelationship(value.transicion_id);
            }

            await new CaseTransitionsUpdater(
                this.repository,
                this.transitionsRepository,
                this.#actionExecutionService,
                this.user,
                this.transitionRuleRepository,
                this.eventPublisher,
                this.tenant
            ).execute(id, value);

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            if (error instanceof CustomError) {
                return HttpResponse.custom(error.message, error.status, this.event);
            }
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End TransitionUpdate');
        }
    }

    async #ensureTransitionRelationship(transitionId) {
        const transitions = await this.repository
            .connection(this.repository.qualifiedName('transiciones'))
            .select('id')
            .where({ id: transitionId })
            .first();

        if (!transitions) {
            throw new CustomError(`Transition with id ${transitionId} does not exist.`, 404);
        }
    }
}
