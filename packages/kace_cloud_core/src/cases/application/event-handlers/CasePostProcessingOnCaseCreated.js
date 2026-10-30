import { ValueObjectUuid } from '../../../shared/index.js';
import { CaseFinder } from '../../domain/CaseFinder.js';
import { KnexSubcaseRelationshipRepository } from '../../infrastructure/persistence/KnexSubcaseRelationshipRepository.js';
import { SubCaseRelationCreator } from '../subcase-relation-create/SubCaseRelationCreator.js';
import ParentUpdater from '../update/ParentUpdater.js';
import { KnexAuxCasesRepository } from '../../../aux_casos/infrastructure/persitance/KnexAuxCasesRepository.js';
import KnexFakeCaseRepository from '../../../fake-cases/infrastructure/persistence/KnexFakeCaseRepository.js';
import FakeCaseFinder from '../../../fake-cases/domain/Finder.js';
import { FakeCaseCreator } from '../../../fake-cases/application/create/FakeCaseCreator.js';
import FakeCaseUpdater from '../../../fake-cases/application/update/FakeCaseUpdater.js';

/**
 * Async consumer of the `kace.core.case.created` event that runs the two post-creation
 * side-effects that used to run synchronously on the case-creation request path:
 *
 *  1. parent-child relation (only when the case has a `parent_id`)
 *  2. fake-case sync (find-or-create/update with `transicion_id = null`)
 *
 * This handler is designed for an at-least-once SQS consumer, so `handle` is idempotent:
 * redelivery of the same event must NOT create duplicate relations and must NOT throw.
 */
export default class CasePostProcessingOnCaseCreated {
    /** @type {import('../../domain/CaseFinder.js').CaseFinder} */
    #caseFinder;

    /** @type {KnexSubcaseRelationshipRepository} */
    #subCasesRepository;

    /** @type {KnexAuxCasesRepository} */
    #auxiliaryRepository;

    /** @type {KnexFakeCaseRepository} */
    #fakeCaseRepository;

    /**
     * Mirrors how the event_processor builds case handlers (from a single
     * `KnexCaseRepository`) and how the controller derives the collaborator
     * repositories from `repository.connection`.
     *
     * @param {KnexCaseRepository} caseRepository
     */
    constructor(caseRepository) {
        const connection = caseRepository.connection;
        this.#caseFinder = new CaseFinder(caseRepository);
        this.#subCasesRepository = new KnexSubcaseRelationshipRepository(connection);
        this.#auxiliaryRepository = new KnexAuxCasesRepository(connection);
        this.#fakeCaseRepository = new KnexFakeCaseRepository(connection);
    }

    /**
     * @param {DomainEvent} domainEvent
     * @returns {Promise<void>}
     */
    async handle(domainEvent) {
        const kase = await this.#caseFinder.execute(domainEvent.aggregateId);
        const caseValue = kase.toJson();

        await this.#syncParentRelation(caseValue);
        await this.#syncFakeCase(caseValue);
    }

    /**
     * Creates the parent-child relation when the case has a parent.
     *
     * Idempotency: `SubCaseRelationCreator.execute` throws `Relation already exist`
     * when the relation is present, so on redelivery we check for the existing
     * relation first and skip creation (find-or-skip). `ParentUpdater.execute`
     * only sets the parent's merged aux data and is safe to re-run.
     *
     * @param {object} caseValue
     * @returns {Promise<void>}
     */
    async #syncParentRelation(caseValue) {
        if (!caseValue.parent_id) {
            return;
        }

        const parentVO = new ValueObjectUuid('id', caseValue.parent_id);
        const childVO = new ValueObjectUuid('id', caseValue.id);
        const existingRelation = await this.#subCasesRepository.find(parentVO, childVO);

        if (!existingRelation) {
            const relationCreator = new SubCaseRelationCreator(this.#subCasesRepository);
            await relationCreator.execute(caseValue.parent_id, caseValue.id, caseValue.created_by);
        }

        const parentUpdater = new ParentUpdater(this.#auxiliaryRepository);
        await parentUpdater.execute(caseValue.id, caseValue.parent_id);
    }

    /**
     * Find-or-create/update the fake-case mirror with `transicion_id = null`.
     * Already idempotent via the find-then-create-or-update pattern.
     *
     * @param {object} caseValue
     * @returns {Promise<void>}
     */
    async #syncFakeCase(caseValue) {
        const existsCase = await new FakeCaseFinder(this.#fakeCaseRepository).execute({ value: caseValue.id });

        if (!existsCase) {
            await new FakeCaseCreator(this.#fakeCaseRepository).execute({ ...caseValue, transicion_id: null });
        } else {
            await new FakeCaseUpdater(this.#fakeCaseRepository).execute(caseValue.id, {
                ...caseValue,
                transicion_id: null,
            });
        }
    }
}
