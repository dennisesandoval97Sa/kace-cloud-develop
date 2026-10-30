import {
    BaseController,
    HttpResponse,
    SearchSchema,
    SearchAuthorizationError,
    SearchAuthorizationService,
} from '@kace/api-common';
import { BoardResourcesSearch } from '@kace/core/src/boards/application/resourcesSearch/BoardResourcesSearch';
import { BoardFinder } from '@kace/core/src/boards/domain/BoardFinder';
import { BoardAccessPolicy } from '@kace/core/src/boards/domain/BoardAccessPolicy';
import { KnexBoardResourcesRepository } from '@kace/core/src/boards/infrastructure/persistence/KnexBoardResourcesRepository';
import { KnexBoardsRepository } from '@kace/core/src/boards/infrastructure/persistence/KnexBoardsRepository';
import { Helper, ValidationFailError } from '@kace/core/src/shared';
import { BOARD_EXPORT_NO_RECORDS, BOARD_REQUIRES_ACTIVE_GROUP } from '@kace/error-codes';
import { BoardExportData } from '@kace/core/src/boards/application/export/BoardExportData';
import { ExportExcelData } from '@kace/core/src/shared/domain/services/ExportExcelData';
import { BoardResourcesCollectionResponse } from '@kace/core/src/boards/application/BoardResourcesCollectionResponse.js';
import { BoardResources } from '@kace/core/src/boards/domain/BoardResources.js';
import { resolveBoardRuntimeFunctions } from '@kace/core/src/boards/domain/resolveBoardRuntimeFunctions.js';

export class ControllerBoardResources extends BaseController {
    constructor(event, knexConfig, readerConfig = null) {
        super(event, knexConfig);
        this.repository = new KnexBoardsRepository(this.database_connection);
        // Build from CONFIG objects (never the Knex instance): an instance collapses the
        // reader onto the writer and silently disables replica routing.
        this.boardResourceRepo = new KnexBoardResourcesRepository(knexConfig, readerConfig);
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

    /**
     * boardResourceRepo owns its own pools (built from configs, not from
     * database_connection), so BaseController's cleanup does not cover it.
     */
    async destroyDbConnection() {
        await super.destroyDbConnection();
        await this.boardResourceRepo.destroyConnection();
    }

    async actionSearch() {
        Helper.logInfo('Begin actionSearchBoardResources');
        try {
            const validation = SearchSchema.validate(this.payload(), { abortEarly: false });
            if (validation.error) {
                return HttpResponse.validationsFail({
                    errors: validation.error,
                    event: this.event,
                });
            }

            const id = this.pathParameters().id;
            if (!this.validateId(id)) {
                return HttpResponse.badRequest({ message: 'Invalid id', event: this.event });
            }

            const page = parseInt(this.event.queryStringParameters?.page ?? '1', 10);
            if (page < 1) {
                return HttpResponse.badRequest({ message: 'Invalid pagination parameters', event: this.event });
            }

            const hasPermission = this.user.hasPermission('administrador', 'boards', 'BoardsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const isExportRequest = this.event.queryStringParameters?.export === 'true';
            if (isExportRequest) {
                const exportsPermission = this.user.hasPermission('administrador', 'boards', 'BoardsExport');
                if (!exportsPermission) {
                    return HttpResponse.forbidden({
                        message: 'You do not have permission to export this resource.',
                        event: this.event,
                    });
                }
            }

            const userGroup = this.user.grupo_activo.value;
            const userId = this.user.id.value;

            const board = await new BoardFinder(this.repository).execute(id);

            // Misma llave maestra que en controller.mjs: la politica tiene que comportarse
            // igual en los dos controladores que la consumen.
            const isBoardAdmin = this.user.hasPermission('administrador', 'boards', 'BoardsAccessAll');

            if (!BoardAccessPolicy.canAccess(board, { userId, groupId: userGroup, isBoardAdmin })) {
                return HttpResponse.forbidden({
                    message: 'User does not have access to this board.',
                    event: this.event,
                });
            }

            const offset = page < 1 ? 0 : (page - 1) * board.page_size.value;

            const baseCriteria = board.criteria?.value || { items: [] };

            const resolved = resolveBoardRuntimeFunctions({
                items: baseCriteria.items,
                userId,
                userGroup,
                rawActiveClient: this.event.queryStringParameters?.active_client,
            });

            if (resolved.kind === 'missing_active_group') {
                return HttpResponse.badRequest({
                    message: 'board_requires_active_group',
                    event: this.event,
                    code: BOARD_REQUIRES_ACTIVE_GROUP,
                });
            }

            if (resolved.kind === 'empty') {
                if (isExportRequest) {
                    const tableName = board.primary_entity.value;
                    throw new ValidationFailError(
                        `No se encontraron registros en "${tableName}" que coincidan con el criterio de búsqueda.`,
                        'criteria',
                        [],
                        BOARD_EXPORT_NO_RECORDS
                    );
                }

                return HttpResponse.ok({
                    ...new BoardResourcesCollectionResponse(new BoardResources([], 0), 0, 1, 1, []).toJson(),
                    event: this.event,
                });
            }

            baseCriteria.items = resolved.items;
            const hasUserFilter = !!validation.value?.filter?.length;
            const hasUserOrder = !!validation.value?.order;

            const dtoCriteria = {
                filter: baseCriteria.items,
                relationship: board.relations.value,
                limit: board.page_size.value,
                offset,
                tableName: board.primary_entity.value,
                select: board.columns.value,
                having: board.havings.value,
                orders: board.orders.value,
                subQuery: hasUserFilter || hasUserOrder ? validation.value : false,
                quickAnsFilter: board.quick_ans_filter?.value ?? null,
            };
            const authorizedQuery = this.#authorizeSearch('boards.board-resources.search', dtoCriteria);

            if (isExportRequest) {
                Helper.logDebug('BoardResources::actionSearch::BoardExportData', dtoCriteria);

                const exportExcelData = new ExportExcelData();
                const exportData = await new BoardExportData(
                    this.boardResourceRepo,
                    board.primary_entity.value,
                    exportExcelData
                ).execute(authorizedQuery);
                return HttpResponse.ok({ ...exportData, event: this.event });
            }

            Helper.logDebug('BoardResources::actionSearch', dtoCriteria);

            const response = await new BoardResourcesSearch(this.boardResourceRepo, board.primary_entity.value).execute(
                authorizedQuery
            );
            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            Helper.logInfo(error);

            const errorMessage = error?.message || '';
            if (errorMessage.includes('columna o relación no válida')) {
                return HttpResponse.badRequest({
                    message: errorMessage,
                    event: this.event,
                });
            }
            return HttpResponse.internalServerError({ errors: error, event: this.event });
        } finally {
            Helper.logInfo('End actionSearchBoardResources');
        }
    }
}
