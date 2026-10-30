import {
    BaseController,
    HttpResponse,
    SearchSchema,
    SearchAuthorizationError,
    SearchAuthorizationService,
} from '@kace/api-common';
import {
    SubCaseRelationCreator,
    SubCaseRelationSearcher,
    SubCaseRelationDeleter,
    KnexSubcaseRelationshipRepository,
} from '@kace/core/src/cases';
import { subCaseRelationSchema } from './schemas.mjs';
import { Helper, InvalidArgumentError } from '@kace/core/src/shared/index.js';

export class SubCasesController extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexSubcaseRelationshipRepository(this.database_connection);
        this.relationCreator = new SubCaseRelationCreator(this.repository);
    }

    async actionCreate() {
        Helper.logInfo('Begin subcases actionCreate');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'subcase-relationships',
                'SubCasesRelationshipCreate'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }
            const parent_case_id = this.event.pathParameters.id;
            if (!this.validateId(parent_case_id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const { value, error } = subCaseRelationSchema.validate(this.payload(), {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            const { child_case_id } = value;

            await this.relationCreator.execute(parent_case_id, child_case_id, this.user.id.value);

            return HttpResponse.created({ event: this.event });
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
        Helper.logInfo('Begin subcases actionSearch');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'subcase-relationships',
                'SubCasesRelationshipRead'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const parent_case_id = this.event?.pathParameters?.id;
            if (!this.validateId(parent_case_id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const { value, error } = SearchSchema.validate(this.payload(), {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            const { filter, limit, offset, order, relationship, select } = value;

            const dtoCriteria = {
                filter: [
                    ...(Array.isArray(filter) ? filter : []),
                    {
                        field: `${this.repository.tableName}.parent_case_id`,
                        operator: 'eq',
                        value: parent_case_id,
                        type: 'AND',
                    },
                ],
                relationship,
                limit,
                offset,
                order,
                select,
            };

            const authorizedQuery = this.#authorizeSearch('cases-2.sub-cases.search', dtoCriteria);
            const response = await new SubCaseRelationSearcher(this.repository).execute(authorizedQuery);

            return HttpResponse.ok({ ...response.toJson(), event: this.event });
        } catch (error) {
            if (error instanceof SearchAuthorizationError) {
                return HttpResponse.forbidden({
                    message: error.message,
                    event: this.event,
                });
            }

            if (error instanceof InvalidArgumentError) {
                return HttpResponse.badRequest({
                    message: error.message,
                    event: this.event,
                });
            }
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionSearch');
        }
    }

    async actionDelete() {
        Helper.logInfo('Begin subcases actionDelete');
        try {
            const hasPermission = this.user.hasPermission(
                'administrador',
                'subcase-relationships',
                'SubCasesRelationshipDelete'
            );
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete this resource.',
                    event: this.event,
                });
            }

            const parent_case_id = this.event.pathParameters.id;
            if (!this.validateId(parent_case_id)) {
                return HttpResponse.badRequest({
                    message: 'Invalid id',
                    event: this.event,
                });
            }

            const { value, error } = subCaseRelationSchema.validate(this.payload(), {
                abortEarly: false,
            });
            if (error) {
                return HttpResponse.validationsFail({
                    errors: error,
                    event: this.event,
                });
            }

            const { child_case_id } = value;

            await new SubCaseRelationDeleter(this.repository).execute(
                parent_case_id,
                child_case_id,
                this.user.id.value
            );

            return HttpResponse.ok({ event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionDelete');
        }
    }

    async destroyDbConnection() {
        await super.destroyDbConnection();
        await this.repository.destroyConnection();
    }
}
