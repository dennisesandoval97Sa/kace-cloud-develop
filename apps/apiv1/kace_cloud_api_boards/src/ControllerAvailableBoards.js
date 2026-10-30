import { BaseController, HttpResponse, SearchAuthorizationError, SearchAuthorizationService } from '@kace/api-common';
import { KnexBoardsRepository } from '@kace/core/src/boards/infrastructure/persistence/KnexBoardsRepository';
import { AvailableBoardsSearcher } from '@kace/core/src/boards/application/search/AvailableBoardsSearcher';
import { Helper } from '@kace/core/src/shared';

export class ControllerAvailableBoards extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexBoardsRepository(this.database_connection);
        this.started_at = new Date();
    }

    #searchAuthorizationService;

    #authorizeSearch(endpointKey, query) {
        this.#searchAuthorizationService ??= new SearchAuthorizationService();
        return this.#searchAuthorizationService.authorize({
            endpointKey,
            user: this.user,
            query,
        });
    }

    async actionSearch() {
        Helper.logInfo('Begin actionSearchAvailableBoards');

        try {
            const hasAdminPermission = this.user.hasPermission('administrador', 'boards', 'BoardsRead');
            const hasAgentPermission = this.user.hasPermission('agente', 'boards', 'BoardsRead');

            if (!hasAdminPermission && !hasAgentPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const userId = this.user.id.value;
            const currentGroup = this.user.grupo_activo.value;

            const searchQuery = {
                userId,
                groupId: currentGroup,
            };
            const authorizedQuery = this.#authorizeSearch('boards.available-boards.search', searchQuery);

            const response = await new AvailableBoardsSearcher(this.repository).execute(authorizedQuery);

            return HttpResponse.ok({
                ...response.toJson(),
                event: this.event,
            });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            Helper.logError(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionSearchAvailableBoards');
        }
    }
}
