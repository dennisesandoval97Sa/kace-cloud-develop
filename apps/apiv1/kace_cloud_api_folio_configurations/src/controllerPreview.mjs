import { HttpResponse } from '@kace/api-common';
import { FolioConfigurationFinder } from '@kace/core/src/folio-configurations/application/find/FolioConfigurationFinder.js';
import { FolioConfiguration } from '@kace/core/src/folio-configurations/domain/FolioConfiguration.js';
import { CaseFolioResolver } from '@kace/core/src/cases/application/folio/CaseFolioResolver.js';
import { Helper } from '@kace/core/src/shared/infrastructure/utils/Helper.js';
import { FolioBaseController, MODULE } from './folioBaseController.mjs';
import { schemaPreview } from './schemas.mjs';

/** Id of an unsaved draft: no counter row has it, so its preview starts at start_value. */
const PREVIEW_PLACEHOLDER_ID = '00000000-0000-4000-8000-000000000000';

/**
 * POST /folio-configurations/preview, dispatched by handler.mjs as POST /.
 *
 * Renders what a configuration would produce, WITHOUT reserving a number: the resolver
 * reads the counter and shows current + 1. Reserving here would burn a consecutive every
 * time an administrator opened the screen. Accepts a saved id, an unsaved draft, or both:
 * while editing a saved configuration the draft gives the layout and the id picks the
 * counter, so the preview shows the real next number and not start_value.
 */
export class ControllerPreview extends FolioBaseController {
    async actionCreate() {
        Helper.logInfo('Begin ControllerPreview::actionCreate');
        try {
            if (!this.user.hasPermission('administrador', MODULE, 'FolioConfigurationsRead')) {
                return this.forbidden('read');
            }

            const { value, error } = schemaPreview.validate(this.payload(), { abortEarly: false });
            if (error) {
                return HttpResponse.validationsFail({ errors: error, event: this.event });
            }

            const saved = value.id ? await new FolioConfigurationFinder(this.repository).execute(value.id) : null;
            const configuration = value.segments ? this.#draft(value, saved?.id.value) : saved;

            const resolver = new CaseFolioResolver(this.repository, this.sequenceRepository);
            const folio = await resolver.preview(configuration, value.context);

            return HttpResponse.ok({ data: { folio }, event: this.event });
        } catch (error) {
            return this.fail(error);
        } finally {
            Helper.logInfo('End ControllerPreview::actionCreate');
        }
    }

    #draft(value, id = PREVIEW_PLACEHOLDER_ID) {
        return FolioConfiguration.create({
            id,
            nombre: 'preview',
            segments: value.segments,
            reset_policy: value.reset_policy,
            start_value: value.start_value,
            overflow_policy: value.overflow_policy,
            status: 1,
            // Never persisted, but AggregateRoot demands both, same as actionCreate.
            created_at: this.started_at,
            created_by: this.user.id.value,
        });
    }
}
