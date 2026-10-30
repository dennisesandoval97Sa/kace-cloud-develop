import { BaseController, HttpResponse } from '@kace/api-common';
import {
    TypeLister,
    FormulaLister,
    AggregateLister,
    CustomerFieldsLister,
    CaseFieldsLister,
    KnexActionUpdateModelRepository,
} from '@kace/core/src/action-update-model';
import { Helper } from '@kace/core/src/shared/index.js';

export class CustomController extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);
        this.repository = new KnexActionUpdateModelRepository(this.database_connection);
        this.started_at = new Date();
    }

    async actionTypes() {
        Helper.logInfo('Begin actionTypes');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'actions', 'ActionTypesRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read action types.',
                    event: this.event,
                });
            }

            const data = new TypeLister().execute();
            return HttpResponse.ok({ data, event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionTypes');
        }
    }

    async actionFormulas() {
        Helper.logInfo('Begin actionFormulas');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'actions', 'ActionFormulasRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read action formulas.',
                    event: this.event,
                });
            }

            const data = new FormulaLister().execute();
            return HttpResponse.ok({ data, event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionFormulas');
        }
    }

    async actionAggregates() {
        Helper.logInfo('Begin actionAggregates');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'actions', 'ActionAggregatesRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read action aggregates.',
                    event: this.event,
                });
            }

            const data = new AggregateLister().execute();
            return HttpResponse.ok({ data, event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionAggregates');
        }
    }

    async actionCustomerFields() {
        Helper.logInfo('Begin actionCustomerFields');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'actions', 'ActionCustomerFieldsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read action customer fields.',
                    event: this.event,
                });
            }

            const data = new CustomerFieldsLister().execute();
            return HttpResponse.ok({ data, event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCustomerFields');
        }
    }

    async actionCaseFields() {
        Helper.logInfo('Begin actionCaseFields');
        try {
            const hasPermission = this.user.hasPermission('administrador', 'actions', 'ActionCaseFieldsRead');
            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read action case fields.',
                    event: this.event,
                });
            }

            const data = new CaseFieldsLister().execute();
            return HttpResponse.ok({ data, event: this.event });
        } catch (error) {
            Helper.logInfo(error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        } finally {
            Helper.logInfo('End actionCaseFields');
        }
    }

    /**
     * @returns {Promise<Response>}
     */
    async run() {
        this.user = await this.getLoggedInUser();
        const actionResult = await this.#newActions();
        await this.destroyDbConnection();
        return actionResult;
    }

    async runCognitoAuth() {
        return this.#newActions();
    }

    /**
     * @returns {Promise<Response>}
     */
    async #newActions() {
        const resource = this.resource();
        const method = this.httpMethod();

        const resourceActions = {
            GET: {
                '/types': this.actionTypes,
                '/formulas': this.actionFormulas,
                '/aggregates': this.actionAggregates,
                '/customer-fields': this.actionCustomerFields,
                '/case-fields': this.actionCaseFields,
            },
        };

        const action = resourceActions[method]?.[resource];
        if (action) {
            return action.call(this);
        }

        if (method === 'GET' || method === 'POST') {
            return HttpResponse.notFound({
                message: `Resource not found: ${resource}`,
                event: this.event,
            });
        }

        return HttpResponse.methodNotAllowed({ event: this.event });
    }

    resource() {
        return this.event.resource;
    }
}
