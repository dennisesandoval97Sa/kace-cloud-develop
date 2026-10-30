import { KnexCaseRepository } from '../../../src/cases/index.js';
import { knexConfig } from '../../knexfile.js';
import CasesMother from '../../cases/domain/CasesMother.js';
import { AuxCasesMother } from '../../aux_casos/domain/AuxCasesMother.js';
import { KnexAuxCasesRepository } from '../../../src/aux_casos/index.js';
import CasePostProcessingOnCaseCreated from '../../../src/cases/application/event-handlers/CasePostProcessingOnCaseCreated.js';

describe('CasePostProcessingOnCaseCreated Integration Tests', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const auxCasesRepository = new KnexAuxCasesRepository(repository.connection);

    function buildHandler() {
        return new CasePostProcessingOnCaseCreated(repository);
    }

    it('creates the fake-case for the created case when handling case.created', async () => {
        const kase = await CasesMother.createCase(repository, { parent_id: null });

        await buildHandler().handle({ aggregateId: kase.id.value });

        const fakeCases = await repository.connection('fake_cases').where({ id: kase.id.value });
        expect(fakeCases.length).toBe(1);
        expect(fakeCases[0].transicion_id).toBeNull();
    });

    it('is idempotent: handling the same event twice leaves exactly one fake-case and does not throw', async () => {
        const kase = await CasesMother.createCase(repository, { parent_id: null });

        const handler = buildHandler();
        await handler.handle({ aggregateId: kase.id.value });
        await expect(handler.handle({ aggregateId: kase.id.value })).resolves.not.toThrow();

        const fakeCases = await repository.connection('fake_cases').where({ id: kase.id.value });
        expect(fakeCases.length).toBe(1);
    });

    it('creates the parent-child relation for a case with parent_id and does not duplicate on redelivery', async () => {
        const parent = await CasesMother.createCase(repository, { parent_id: null });
        const child = await CasesMother.createCase(repository, { parent_id: parent.id.value });

        await AuxCasesMother.createAuxCase(auxCasesRepository, { caso_id: parent.id.value });
        await AuxCasesMother.createAuxCase(auxCasesRepository, { caso_id: child.id.value });

        const handler = buildHandler();
        await handler.handle({ aggregateId: child.id.value });

        const relationsAfterFirst = await repository
            .connection('rel_cases_subcases')
            .where({ parent_case_id: parent.id.value, child_case_id: child.id.value });
        expect(relationsAfterFirst.length).toBe(1);

        await expect(handler.handle({ aggregateId: child.id.value })).resolves.not.toThrow();

        const relationsAfterSecond = await repository
            .connection('rel_cases_subcases')
            .where({ parent_case_id: parent.id.value, child_case_id: child.id.value });
        expect(relationsAfterSecond.length).toBe(1);
    });

    it('does not attempt a relation for a case without parent_id and does not throw', async () => {
        const kase = await CasesMother.createCase(repository, { parent_id: null });

        await expect(buildHandler().handle({ aggregateId: kase.id.value })).resolves.not.toThrow();

        const relations = await repository.connection('rel_cases_subcases').where({ child_case_id: kase.id.value });
        expect(relations.length).toBe(0);
    });
});
