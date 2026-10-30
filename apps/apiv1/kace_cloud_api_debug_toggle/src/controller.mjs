import { BaseController, HttpResponse } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';
import { LambdaDebugService } from './services/LambdaDebugService.mjs';
import { DebugScheduler } from './services/DebugScheduler.mjs';
import { TenantDebugFlag } from './services/TenantDebugFlag.mjs';
import { schemaDisable, schemaEnable, schemaStatusPath } from './schemas.mjs';

export default class Controller extends BaseController {
    #lambdaService;
    #scheduler;
    #tenantDebugFlag;

    constructor(event, knexConfig, deps = {}) {
        super(event, knexConfig);
        this.event = event;
        this.#lambdaService = deps.lambdaService ?? new LambdaDebugService();
        this.#scheduler = deps.scheduler ?? new DebugScheduler();
        this.#tenantDebugFlag = deps.tenantDebugFlag ?? new TenantDebugFlag();
    }

    async run() {
        try {
            this.user = await this.getLoggedInUser();
        } catch (error) {
            Helper.logError('Error getLoggedInUser', error);
            return HttpResponse.badRequest({
                message: error.message,
                errors: error,
                event: this.event,
            });
        }

        try {
            return await this.#dispatch();
        } finally {
            await this.destroyDbConnection();
        }
    }

    async #dispatch() {
        const resource = this.event.resource;
        const method = this.event.httpMethod;

        if (method === 'POST' && resource === '/enable') return this.actionEnable();
        if (method === 'POST' && resource === '/disable') return this.actionDisable();
        if (method === 'GET' && resource === '/status/{target}') return this.actionStatus();

        return HttpResponse.notFound({
            message: `Resource not found: ${method} ${resource}`,
            event: this.event,
        });
    }

    #ensureSuperadmin() {
        const value = this.user?.superadmin?.value;
        return value === true || value === 1;
    }

    #forbiddenSuperadmin() {
        return HttpResponse.forbidden({
            message: 'Only superadmin users can use the debug toggle API.',
            event: this.event,
        });
    }

    async actionEnable() {
        Helper.logInfo('Begin actionEnable');
        try {
            if (!this.#ensureSuperadmin()) {
                return this.#forbiddenSuperadmin();
            }

            const data = schemaEnable.validate(this.payload(), { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const { target, minutes, level } = data.value;
            const { fnName, previousAppsDebug, previousAppsDebugLevel } = await this.#lambdaService.enable(
                target,
                level
            );
            const targetKebab = this.#lambdaService.normalizeTarget(target);
            const tenantId = this.event.tenantContext?.tenant_id;
            const { expiresAt, scheduleName } = await this.#scheduler.scheduleDisable(
                targetKebab,
                minutes,
                tenantId,
                target
            );

            Helper.logInfo('Debug enabled', {
                actor: this.user?.login?.value,
                target,
                fnName,
                minutes,
                level,
                previousAppsDebug,
                previousAppsDebugLevel,
                expiresAt,
            });

            return HttpResponse.ok({
                data: {
                    target,
                    fnName,
                    minutes,
                    level,
                    expiresAt,
                    scheduleName,
                    previousAppsDebug,
                },
                event: this.event,
            });
        } catch (error) {
            return this.#mapError(error, 'actionEnable');
        } finally {
            Helper.logInfo('End actionEnable');
        }
    }

    async actionDisable() {
        Helper.logInfo('Begin actionDisable');
        try {
            if (!this.#ensureSuperadmin()) {
                return this.#forbiddenSuperadmin();
            }

            const data = schemaDisable.validate(this.payload(), { abortEarly: false });
            if (data.error) {
                return HttpResponse.validationsFail({
                    errors: data.error,
                    event: this.event,
                });
            }

            const { target } = data.value;
            const { fnName } = await this.#lambdaService.disable(target);
            const targetKebab = this.#lambdaService.normalizeTarget(target);
            const { canceled } = await this.#scheduler.cancelPending(targetKebab);

            const tenantId = this.event.tenantContext?.tenant_id;
            const { updated: dynamoReset } = await this.#tenantDebugFlag.disable(tenantId);

            Helper.logInfo('Debug disabled', {
                actor: this.user?.login?.value,
                target,
                fnName,
                scheduleCanceled: canceled,
                dynamoReset,
            });

            return HttpResponse.ok({
                data: { target, fnName, scheduleCanceled: canceled, dynamoReset },
                event: this.event,
            });
        } catch (error) {
            return this.#mapError(error, 'actionDisable');
        } finally {
            Helper.logInfo('End actionDisable');
        }
    }

    async actionStatus() {
        Helper.logInfo('Begin actionStatus');
        try {
            if (!this.#ensureSuperadmin()) {
                return this.#forbiddenSuperadmin();
            }

            const rawTarget = decodeURIComponent(this.pathParameters()?.target ?? '');
            const validation = schemaStatusPath.validate({ target: rawTarget });
            if (validation.error) {
                return HttpResponse.validationsFail({
                    errors: validation.error,
                    event: this.event,
                });
            }

            const status = await this.#lambdaService.getStatus(rawTarget);
            const targetKebab = this.#lambdaService.normalizeTarget(rawTarget);
            const pending = await this.#scheduler.getPending(targetKebab);

            return HttpResponse.ok({
                data: {
                    target: rawTarget,
                    fnName: status.fnName,
                    APPS_DEBUG: status.APPS_DEBUG,
                    APPS_DEBUG_LEVEL: status.APPS_DEBUG_LEVEL,
                    expiresAt: pending.expiresAt,
                },
                event: this.event,
            });
        } catch (error) {
            return this.#mapError(error, 'actionStatus');
        } finally {
            Helper.logInfo('End actionStatus');
        }
    }

    #mapError(error, ctx) {
        Helper.logError(`Error in ${ctx}`, error);
        if (error?.statusCode === 404) {
            return HttpResponse.notFound({ message: error.message, event: this.event });
        }
        if (error?.statusCode === 409) {
            return HttpResponse.badRequest({
                message: error.message,
                errors: { matches: error.matches },
                event: this.event,
            });
        }
        if (error?.statusCode === 400) {
            return HttpResponse.badRequest({ message: error.message, event: this.event });
        }
        return HttpResponse.internalServerError({ errors: error, event: this.event });
    }
}
