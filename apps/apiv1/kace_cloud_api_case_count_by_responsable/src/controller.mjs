import { BaseController, HttpResponse } from '@kace/api-common';
import {
    CasesCounter,
    ConfiguredViewCaseRepositoryFactory,
    KnexCaseRepository,
    ViewCasesResponsibleCounter,
} from '@kace/core/src/cases/index.js';
import { CustomError } from '@kace/core/src/shared/errors/CustomError';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig, readerConfig = null) {
        super(event, knexConfig);
        // Build from CONFIG objects (never the Knex instance): an instance collapses the
        // reader onto the writer and silently disables replica routing.
        this.repository = new KnexCaseRepository(knexConfig, readerConfig);
        this.started_at = new Date();
    }

    /**
     * The repository above owns its own pools (built from configs, not from
     * database_connection), so BaseController's cleanup does not cover it.
     */
    async destroyDbConnection() {
        await super.destroyDbConnection();
        await this.repository.destroyConnection();
    }

    async actionRead() {
        Helper.logInfo('Begin actionRead');
        try {
            const id = this.pathParameters().id;
            const hasAdminPermission = this.user.hasPermission('administrador', 'cases', 'CasesRead');
            const isSelfCounter = this.user?.id?.value === id;
            if (!hasAdminPermission && !isSelfCounter) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            if (!this.validateId(id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const response = await new CasesCounter(this.repository).execute({
                field: 'responsable_id',
                value: id,
            });
            return HttpResponse.ok({ ...response, event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionRead');
        }
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        let viewRepository;
        try {
            const hasPermission = this.user.hasPermission('administrador', 'cases', 'CasesRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const globalConfig = await this.getGlobalConfig();
            const { knexConfig, readerConfig } = this.event.tenantContext;
            viewRepository = await new ConfiguredViewCaseRepositoryFactory(this.database_connection, {
                knexConfig,
                readerConfig,
            }).create(globalConfig);
            const response = await new ViewCasesResponsibleCounter(viewRepository).execute();
            return HttpResponse.ok({ ...response, event: this.event });
        } catch (error) {
            Helper.logError('Error counting cases by responsable', error);
            if (error instanceof CustomError) {
                return HttpResponse.badRequest({ message: error.message, event: this.event });
            }
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            if (viewRepository) {
                await viewRepository.destroyConnection();
            }
            Helper.logInfo('End actionIndex');
        }
    }
}
