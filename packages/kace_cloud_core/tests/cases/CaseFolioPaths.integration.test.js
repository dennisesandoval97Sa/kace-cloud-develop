import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository } from '../../src/cases';
import { CaseCreator } from '../../src/cases/application/create/CaseCreator.js';
import { CaseDescriptionCreator } from '../../src/case-descriptions/application/create/CaseDescriptionCreator.js';
import { KnexCaseDescriptionRepository } from '../../src/case-descriptions/infrastructure/persistence/KnexCaseDescriptionRepository.js';
import { CaseCloner } from '../../src/cases/application/clone/CaseCloner.js';
import { CaseFolioResolver } from '../../src/cases/application/folio/CaseFolioResolver.js';
import { KnexFolioConfigurationRepository } from '../../src/folio-configurations/infrastructure/KnexFolioConfigurationRepository.js';
import { KnexFolioSequenceRepository } from '../../src/folio-configurations/infrastructure/KnexFolioSequenceRepository.js';
import { KnexAuxCasesRepository } from '../../src/aux_casos';
import { AuxDefinitionDataStructureFinder } from '../../src/aux_definitions/application/find/AuxDefinitionDataStructureFinder.js';
import { KnexAuxDefinitionsRepository } from '../../src/aux_definitions/infrastructure/persitance/KnexAuxDefinitionsRepository.js';
import { KnexSchemasRepository } from '../../src/schemas/infrastructure/persistence/KnexSchemasRepository.js';
import { ClientFactory } from '../../src/factories/ClientFactory.js';
import { TransitionFactory } from '../../src/factories/TransitionFactory.js';
import { UserFactory } from '../../src/factories/UserFactory.js';
import { ClassificationFactory } from '../../src/factories/ClassificationFactory.js';
import { GroupFactory } from '../../src/factories/GroupFactory.js';
import { FolioConfigurationMother } from '../folio-configurations/domain/FolioConfigurationMother.js';

const SEGMENTS = [
    { type: 'literal', value: 'RAD-' },
    { type: 'sequence', length: 4, pad_char: '0' },
];

describe('Folio en los caminos que crean casos', () => {
    const repository = new KnexCaseRepository(knexConfig);
    const folioConfigurations = new KnexFolioConfigurationRepository(repository.connection);
    const folioSequences = new KnexFolioSequenceRepository(repository.connection);
    const resolver = new CaseFolioResolver(folioConfigurations, folioSequences);
    let base;

    beforeEach(async () => {
        const client = await new ClientFactory(knexConfig).create();
        const transition = await new TransitionFactory(knexConfig).create({ status: 1 });
        const user = await new UserFactory(knexConfig).create({ apellido1: 'Ramirez', apellido2: 'Delgado' });
        const group = await new GroupFactory(knexConfig).create();
        base = {
            cliente_id: client.id.value,
            transicion_id: transition.id.value,
            responsable_id: user.id.value,
            grupo_id: group.id.value,
            created_by: user.id.value,
        };
    });

    /** A classification whose cases get folios from a fresh `RAD-{seq:4}` configuration. */
    async function classificationWithFolio() {
        const classification = await new ClassificationFactory(knexConfig).create();
        const configuration = await FolioConfigurationMother.create(folioConfigurations, {
            segments: SEGMENTS,
            start_value: 1,
        });
        await repository
            .connection('clasificaciones')
            .where({ id: classification.id.value })
            .update({ folio_config_id: configuration.id.value });
        return classification.id.value;
    }

    async function createCase(clasificacionId) {
        const now = new Date().toISOString();
        const description = { id: uuidv4(), descripcion: 'folio test', created_at: now, created_by: base.created_by };
        const dto = {
            ...base,
            id: uuidv4(),
            clasificacion_id: clasificacionId,
            descripcion_caso_id: description.id,
            alto_impacto: 1,
            vista: 'folio-test',
            update_source: 'manual',
            created_at: new Date().toISOString(),
        };
        const { kase } = await repository.connection.transaction(async (trx) => {
            await new CaseDescriptionCreator(new KnexCaseDescriptionRepository(knexConfig)).execute(description, trx);
            return new CaseCreator(repository, null, null, null, { id: { value: base.responsable_id } }).execute(dto, {
                trx,
                skipTransitionValidation: true,
                folioResolver: resolver,
            });
        });
        return kase;
    }

    /*
     * Dos configuraciones con la misma estructura y contadores independientes: el segundo caso
     * renderiza un folio que ya existe. Antes el rollback devolvía el número y cada reintento
     * chocaba con el mismo folio; ahora se salta y el caso se crea con el siguiente.
     */
    it('una colisión entre configuraciones no bloquea la creación de casos', async () => {
        const first = await classificationWithFolio();
        const second = await classificationWithFolio();

        expect((await createCase(first)).folio.value).toBe('RAD-0001');
        expect((await createCase(second)).folio.value).toBe('RAD-0002');
        expect((await createCase(second)).folio.value).toBe('RAD-0003');
    });

    it('el clon de un caso con folio recibe uno propio de su clasificación', async () => {
        const clasificacionId = await classificationWithFolio();
        const original = await createCase(clasificacionId);
        const auxCasesRepository = new KnexAuxCasesRepository(repository.connection);
        const dataStructureFinder = new AuxDefinitionDataStructureFinder(
            new KnexAuxDefinitionsRepository(repository.connection),
            new KnexSchemasRepository(repository.connection)
        );

        const cloneId = uuidv4();
        await new CaseCloner(repository, auxCasesRepository, dataStructureFinder, null, resolver).execute(
            original.id.value,
            { id: cloneId },
            base.responsable_id
        );

        const row = await repository.connection('cases').first('folio').where({ id: cloneId });
        expect(original.folio.value).toBe('RAD-0001');
        expect(row.folio).toBe('RAD-0002');
    });
});
