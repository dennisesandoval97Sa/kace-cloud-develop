import { BaseController, HttpResponse } from '@kace/api-common';
import { ConfiguredViewCaseRepositoryFactory, ViewCasesCounter } from '@kace/core/src/cases/index.js';
import { CustomError } from '@kace/core/src/shared/errors/CustomError';
import { Helper } from '@kace/core/src/shared/index.js';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.started_at = new Date();
    }

    async actionIndex() {
        Helper.logInfo('Begin actionIndex');
        let viewRepository;
        try {
            const hasAdminPermission = this.user.hasPermission('administrador', 'case-count', 'CaseCountRead');
            const hasAgentPermission = this.user.hasPermission('agente', 'case-count', 'CaseCountRead');

            if (!hasAdminPermission && !hasAgentPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read case count.',
                    event: this.event,
                });
            }

            const globalConfig = await this.getGlobalConfig();
            const { knexConfig, readerConfig } = this.event.tenantContext;
            viewRepository = await new ConfiguredViewCaseRepositoryFactory(this.database_connection, {
                knexConfig,
                readerConfig,
            }).create(globalConfig);
            const response = await new ViewCasesCounter(viewRepository).execute();

            return HttpResponse.ok({ ...response, event: this.event });
        } catch (error) {
            Helper.logError('Error reading case count', error);
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
