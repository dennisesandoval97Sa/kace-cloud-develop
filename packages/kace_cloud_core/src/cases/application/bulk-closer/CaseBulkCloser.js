import { ValueObjectUpdateSource } from '../../domain/ValueObjectUpdateSource';
import { findAndValidateCases } from '../../domain/BulkCaseValidator';
import { EventLogger } from '../../../shared/EventLogger';
import { CommentBatchCreator } from '../../../comments/application/create/CommentBatchCreator';

export class CaseBulkCloser {
    #casesRepository;
    #commentsRepository;
    #user;

    constructor(casesRepository, user, commentsRepository = null) {
        this.#casesRepository = casesRepository;
        this.#commentsRepository = commentsRepository;
        this.#user = user;
        this.eventLogger = new EventLogger(casesRepository);
    }

    async execute(caseIds, closeReason) {
        const { cases } = await this.#casesRepository.withTransaction(async (trx) => {
            const { uniqueCaseIds, cases } = await findAndValidateCases(this.#casesRepository, caseIds, {
                trx,
                forUpdate: true,
            });

            const now = new Date();
            const closePayload = {
                fecha_resolucion: now,
                motivo_baja: closeReason,
                update_source: ValueObjectUpdateSource.BULK,
                updated_at: now,
                updated_by: this.#user.id.value,
            };

            if (!this.#user?.isServiceAccount) {
                closePayload.edited_by = this.#user.id.value;
                closePayload.edited_at = now;
            }

            await this.#casesRepository.bulkClose(uniqueCaseIds, closePayload, { trx });

            if (closeReason && this.#commentsRepository) {
                await new CommentBatchCreator(this.#commentsRepository).execute(
                    cases.map((kase) => ({
                        id: crypto.randomUUID(),
                        descripcion: closeReason,
                        caso_id: kase.id?.value ?? kase.id,
                        created_by: this.#user.id.value,
                        updated_by: this.#user.id.value,
                        created_at: now,
                        updated_at: now,
                    })),
                    trx
                );
            }

            return { cases };
        });

        const now = new Date();

        await Promise.all(
            cases.map((kase) =>
                this.eventLogger.log(
                    'case.closed',
                    kase.id,
                    this.#user.id.value,
                    {
                        fecha_resolucion: now,
                        motivo_baja: closeReason,
                        update_source: ValueObjectUpdateSource.BULK,
                    },
                    kase.id,
                    kase.cliente_id,
                    {
                        fecha_resolucion: kase.fecha_resolucion,
                        transicion_id: kase.transicion_id,
                        update_source: kase.update_source,
                    }
                )
            )
        );
    }
}
