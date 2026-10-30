import { v4 as uuidV4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { InteractionCreator } from '../../src/interactions/application/create/InteractionCreator.js';
import { AssociateInteractionToCaso } from '../../src/interactions/application/associateInteractionToCaso/AssociateInteractionToCaso.js';
import { LinkedInteractionCasesFinder } from '../../src/interactions/application/linked-cases/LinkedInteractionCasesFinder.js';
import { KnexAssociateInteractionToCasoRepo } from '../../src/interactions/infrastructure/persistence/KnexAssociateInteractionToCasoRepo.js';
import { KnexInteractionRepository } from '../../src/interactions/infrastructure/persistence/KnexInteractionRepository.js';
import { AssociateInteractionToCasoSearch } from '../../src/interactions/application/associateInteractionToCasoSearch/AssociateInteractionToCasoSearch.js';
import { InteractionCollectionResponse } from '../../src/interactions/application/InteractionCollectionResponse.js';
import InteractionMother from './domain/InteractionMother.js';
import CasesMother from '../cases/domain/CasesMother.js';

describe('Associate Interaction to Caso', () => {
    const repository = new KnexInteractionRepository(knexConfig);
    const casesRepo = new KnexCaseRepository(repository.connection);
    const interactionRepo = new KnexAssociateInteractionToCasoRepo(repository.connection);

    const baseCaso = () => ({
        id: uuidV4(),
        cliente_id: uuidV4(),
        transicion_id: uuidV4(),
        responsable_id: uuidV4(),
        clasificacion_id: uuidV4(),
        descripcion_caso_id: uuidV4(),
        grupo_id: uuidV4(),
        motivo_baja: 'motivo baja',
        alto_impacto: 1,
        vista: 'vista',
        fecha_resolucion: null,
        ans_posicion: null,
        antiguedad_dias: null,
        antiguedad_horas: null,
        antiguedad_minutos: null,
        state_change_at: new Date().toISOString(),
        state_elapsed_days: null,
        state_elapsed_hours: null,
        state_elapsed_minutes: null,
        state_elapsed_time: null,
        external_code: null,
        sla_id: null,
        sla_state_id: null,
        parent_id: null,
        deleted_at: null,
        created_by: uuidV4(),
        created_at: new Date().toISOString(),
    });

    /**
     * Helper function to insert a case directly into the database
     * This avoids CaseCreator's SLA processing side effects
     * Note: Table was renamed from 'casos' to 'cases' in migration
     */
    const insertCaso = async (casoDto) => {
        // `baseCaso()` inventa todos los ids de las columnas foraneas de `cases`.
        // Postgres exige que esas filas padre existan, asi que las respaldamos aqui,
        // en el unico punto por el que pasan todas las inserciones del archivo.
        await CasesMother.ensureRelations(repository.connection, casoDto, {});
        await repository.connection('cases').insert(casoDto);
    };

    it('associates an existing Interaction with an existing Caso', async () => {
        const interactionDto = InteractionMother.dto();
        await InteractionMother.ensureRelations(repository.connection, interactionDto);
        const casoDto = baseCaso();

        const interactionCreator = new InteractionCreator(repository);
        await interactionCreator.execute(interactionDto);
        await insertCaso(casoDto);

        const dto = {
            interaction_id: interactionDto.id,
            caso_id: casoDto.id,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        };

        const useCase = new AssociateInteractionToCaso(interactionRepo, casesRepo, repository);

        await useCase.execute(dto);

        const rows = await repository
            .connection('interaction_casos')
            .where({ interaction_id: interactionDto.id, caso_id: casoDto.id });

        expect(rows.length).toBe(1);
    });

    it('does not duplicate an existing association', async () => {
        const interactionDto = InteractionMother.dto();
        await InteractionMother.ensureRelations(repository.connection, interactionDto);
        const casoDto = baseCaso();

        const interactionCreator = new InteractionCreator(repository);
        await interactionCreator.execute(interactionDto);
        await insertCaso(casoDto);

        const dto = {
            interaction_id: interactionDto.id,
            caso_id: casoDto.id,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        };

        const useCase = new AssociateInteractionToCaso(interactionRepo, casesRepo, repository);

        await useCase.execute(dto);
        await useCase.execute(dto);

        const rows = await repository
            .connection('interaction_casos')
            .where({ interaction_id: interactionDto.id, caso_id: casoDto.id });

        expect(rows?.length).toBe(1);
    });

    it('returns linked case ids and display summaries for an interaction', async () => {
        const interactionDto = InteractionMother.dto();
        await InteractionMother.ensureRelations(repository.connection, interactionDto);
        const caseOne = { ...baseCaso(), reference: 101, external_code: 'EXT-101' };
        const caseTwo = { ...baseCaso(), reference: 102, external_code: 'EXT-102', parent_id: caseOne.id };

        const interactionCreator = new InteractionCreator(repository);
        await interactionCreator.execute(interactionDto);
        await insertCaso(caseOne);
        await insertCaso(caseTwo);

        const useCase = new AssociateInteractionToCaso(interactionRepo, casesRepo, repository);
        await useCase.execute({
            interaction_id: interactionDto.id,
            caso_id: caseOne.id,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        });
        await useCase.execute({
            interaction_id: interactionDto.id,
            caso_id: caseTwo.id,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        });

        const result = await new LinkedInteractionCasesFinder(interactionRepo, casesRepo).execute(interactionDto.id);

        expect(result.case_ids).toEqual(expect.arrayContaining([caseOne.id, caseTwo.id]));
        const expectedDisplaySummaryFields = {
            estadoActual: null,
            nivel1: null,
            nivel2: null,
            nivel3: null,
            nivel4: null,
            nivel5: null,
            nivel6: null,
            nivel7: null,
            nivel8: null,
            nivel9: null,
            nivel10: null,
            responsible_login: null,
            responsible_name: '',
        };
        expect(result.items).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: caseOne.id,
                    reference: 101,
                    external_code: 'EXT-101',
                    parent_id: null,
                    ...expectedDisplaySummaryFields,
                }),
                expect.objectContaining({
                    id: caseTwo.id,
                    reference: 102,
                    external_code: 'EXT-102',
                    parent_id: caseOne.id,
                    ...expectedDisplaySummaryFields,
                }),
            ])
        );
    });

    it('returns an empty linked case response when an interaction has no cases', async () => {
        const interactionDto = InteractionMother.dto();
        await InteractionMother.ensureRelations(repository.connection, interactionDto);
        await new InteractionCreator(repository).execute(interactionDto);

        const result = await new LinkedInteractionCasesFinder(interactionRepo, casesRepo).execute(interactionDto.id);

        expect(result).toEqual({ case_ids: [], items: [] });
    });

    it('throws error if Interaction does not exist', async () => {
        const nonExistentInteractionId = uuidV4();
        const casoDto = baseCaso();
        await insertCaso(casoDto);

        const dto = {
            interaction_id: nonExistentInteractionId,
            caso_id: casoDto.id,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        };

        const useCase = new AssociateInteractionToCaso(interactionRepo, casesRepo, repository);

        await expect(useCase.execute(dto)).rejects.toThrow('Interaction not found');
    });

    it('throws error if Caso does not exist', async () => {
        const interactionDto = InteractionMother.dto();
        await InteractionMother.ensureRelations(repository.connection, interactionDto);
        const nonExistentCasoId = uuidV4();

        const interactionCreator = new InteractionCreator(repository);
        await interactionCreator.execute(interactionDto);

        const dto = {
            interaction_id: interactionDto.id,
            caso_id: nonExistentCasoId,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        };

        const useCase = new AssociateInteractionToCaso(interactionRepo, casesRepo, repository);

        await expect(useCase.execute(dto)).rejects.toThrow();
    });

    it('throws error if dto is null', async () => {
        const useCase = new AssociateInteractionToCaso(interactionRepo, casesRepo, repository);

        await expect(useCase.execute(null)).rejects.toThrow('dto cannot be null or undefined');
    });

    it('throws error if dto is undefined', async () => {
        const useCase = new AssociateInteractionToCaso(interactionRepo, casesRepo, repository);

        await expect(useCase.execute(undefined)).rejects.toThrow('dto cannot be null or undefined');
    });

    it('should return empty collection when pivot has no rows', async () => {
        const dtoCriteria = {
            filter: undefined,
            relationships: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const searcher = new AssociateInteractionToCasoSearch(interactionRepo, repository);

        const result = await searcher.execute(dtoCriteria);

        expect(result).toBeInstanceOf(InteractionCollectionResponse);
        expect(result.toJson().data.items).toHaveLength(0);
        expect(result.toJson().metadata.count).toBe(0);
    });

    it('should return interactions associated to a caso through pivot', async () => {
        const casoDto = baseCaso();
        const interactionDto1 = InteractionMother.dto();
        await InteractionMother.ensureRelations(repository.connection, interactionDto1);
        const interactionDto2 = InteractionMother.dto();
        await InteractionMother.ensureRelations(repository.connection, interactionDto2);

        const interactionCreator = new InteractionCreator(repository);

        await insertCaso(casoDto);
        await interactionCreator.execute(interactionDto1);
        await interactionCreator.execute(interactionDto2);

        const useCase = new AssociateInteractionToCaso(interactionRepo, casesRepo, repository);

        await useCase.execute({
            interaction_id: interactionDto1.id,
            caso_id: casoDto.id,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        });

        await useCase.execute({
            interaction_id: interactionDto2.id,
            caso_id: casoDto.id,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        });

        const dtoCriteria = {
            filter: [{ field: 'caso_id', operator: 'eq', value: casoDto.id, type: 'AND' }],
            relationships: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const searcher = new AssociateInteractionToCasoSearch(interactionRepo, repository);

        const result = await searcher.execute(dtoCriteria);
        const json = result.toJson();

        expect(result).toBeInstanceOf(InteractionCollectionResponse);
        expect(json.data.items).toHaveLength(2);
        expect(json.metadata.count).toBe(2);

        const ids = json.data.items.map((i) => i.id);
        expect(ids).toEqual(expect.arrayContaining([interactionDto1.id, interactionDto2.id]));
    });

    it('should filter interactions by caso_id', async () => {
        const casoDto1 = baseCaso();
        const casoDto2 = baseCaso();
        const interactionDto1 = InteractionMother.dto();
        await InteractionMother.ensureRelations(repository.connection, interactionDto1);
        const interactionDto2 = InteractionMother.dto();
        await InteractionMother.ensureRelations(repository.connection, interactionDto2);

        const interactionCreator = new InteractionCreator(repository);

        await insertCaso(casoDto1);
        await insertCaso(casoDto2);
        await interactionCreator.execute(interactionDto1);
        await interactionCreator.execute(interactionDto2);

        const useCase = new AssociateInteractionToCaso(interactionRepo, casesRepo, repository);

        await useCase.execute({
            interaction_id: interactionDto1.id,
            caso_id: casoDto1.id,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        });

        await useCase.execute({
            interaction_id: interactionDto2.id,
            caso_id: casoDto2.id,
            created_by: uuidV4(),
            created_at: new Date().toISOString(),
        });

        const dtoCriteria = {
            filter: [{ field: 'caso_id', operator: 'eq', value: casoDto1.id, type: 'AND' }],
            relationships: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const searcher = new AssociateInteractionToCasoSearch(interactionRepo, repository);

        const result = await searcher.execute(dtoCriteria);
        const json = result.toJson();

        expect(json.data.items).toHaveLength(1);
        expect(json.data.items[0].id).toBe(interactionDto1.id);
    });

    // TODO: Same issue as above - Criteria expects string for 'in' operator but gets array
    it('should handle pagination when searching associations', async () => {
        const casoDto = baseCaso();
        await insertCaso(casoDto);

        const interactionCreator = new InteractionCreator(repository);
        const useCase = new AssociateInteractionToCaso(interactionRepo, casesRepo, repository);

        for (let i = 0; i < 5; i++) {
            const interactionDto = InteractionMother.dto();
            await InteractionMother.ensureRelations(repository.connection, interactionDto);
            await interactionCreator.execute(interactionDto);
            await useCase.execute({
                interaction_id: interactionDto.id,
                caso_id: casoDto.id,
                created_by: uuidV4(),
                created_at: new Date().toISOString(),
            });
        }

        const dtoCriteria = {
            filter: [{ field: 'caso_id', operator: 'eq', value: casoDto.id, type: 'AND' }],
            relationships: undefined,
            limit: 2,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };

        const searcher = new AssociateInteractionToCasoSearch(interactionRepo, repository);

        const result = await searcher.execute(dtoCriteria);
        const json = result.toJson();

        expect(json.data.items.length).toBeLessThanOrEqual(2);
    });
});
