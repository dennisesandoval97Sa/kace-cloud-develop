import { BaseController, HttpResponse } from '@kace/api-common';
import { Helper } from '@kace/core/src/shared/index.js';

import { QuickLinkCreator } from '@kace/core/src/quick-links/application/create/QuickLinkCreator.js';
import { QuickLinksSearcher } from '@kace/core/src/quick-links/application/search/QuickLinksSearcher.js';
import { QuickLinkDeleter } from '@kace/core/src/quick-links/application/delete/QuickLinkDeleter.js';
import { QuickLinkResponse } from '@kace/core/src/quick-links/application/QuickLinkResponse.js';
import { KnexQuickLinksRepository } from '@kace/core/src/quick-links/infrastructure/persistence/KnexQuickLinksRepository.js';

import { createSchema } from './schemas.mjs';

export class Controller extends BaseController {
    constructor(event, knexConfig) {
        super(event, knexConfig);

        const { readerConfig } = this.event.tenantContext;
        this.repository = new KnexQuickLinksRepository(knexConfig, readerConfig);
    }

    async destroyDbConnection() {
        await this.repository.destroyConnection();
        await super.destroyDbConnection();
    }

    async actionIndex() {
        try {
            const hasPermission = this.user.hasPermission('administrador', 'quick_links', 'QuickLinksRead');

            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to read this resource.',
                    event: this.event,
                });
            }

            const links = await new QuickLinksSearcher(this.repository).execute();

            const items = links.map((link) => new QuickLinkResponse(link).toJson());

            return HttpResponse.ok({
                data: { items },
                event: this.event,
            });
        } catch (error) {
            Helper.logError('Error listing quick links:', error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        }
    }

    async actionCreate() {
        try {
            const hasPermission = this.user.hasPermission('administrador', 'quick_links', 'QuickLinksCreate');

            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to create this resource.',
                    event: this.event,
                });
            }

            const validation = createSchema.validate(this.payload(), { abortEarly: false });

            if (validation.error) {
                return HttpResponse.validationsFail({
                    errors: validation.error,
                    event: this.event,
                });
            }

            const quickLink = await new QuickLinkCreator(this.repository).execute({
                ...validation.value,
                created_by: this.user.id.value,
            });

            return HttpResponse.created({
                data: new QuickLinkResponse(quickLink).toJson(),
                event: this.event,
            });
        } catch (error) {
            Helper.logError('Error creating quick link:', error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        }
    }

    async actionDelete() {
        try {
            const hasPermission = this.user.hasPermission('administrador', 'quick_links', 'QuickLinksDelete');

            if (!hasPermission) {
                return HttpResponse.forbidden({
                    message: 'You do not have permission to delete this resource.',
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

            const deleted = await new QuickLinkDeleter(this.repository).execute(id, this.user.id.value);

            if (!deleted) {
                return HttpResponse.notFound({
                    event: this.event,
                });
            }

            return HttpResponse.ok({
                event: this.event,
            });
        } catch (error) {
            Helper.logError('Error deleting quick link:', error);
            return HttpResponse.internalServerError({
                errors: error,
                event: this.event,
            });
        }
    }
}
