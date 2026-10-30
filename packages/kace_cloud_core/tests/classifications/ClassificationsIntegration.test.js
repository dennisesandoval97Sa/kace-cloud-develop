import {
    Classification,
    ClassificationCollectionResponse,
    ClassificationCounter,
    ClassificationCreator,
    ClassificationDeleter,
    ClassificationFinder,
    ClassificationResponse,
    ClassificationSearcher,
    ClassificationUpdater,
    KnexClassificationRepository,
    DomainClassificationFinder,
} from '../../src/classifications';
import ClassificationsMother from './domain/ClassificationsMother';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { CustomError, ValidationFailError } from '../../src/shared/index.js';
import {
    IdsValidator,
    KnexClassificationTemplateRelationsRepository,
} from '../../src/classification-template-relations/index.js';
import { KnexTemplatesRepository } from '../../src/templates/index.js';
import TemplatesMother from '../templates/domain/TemplatesMother.js';
import { CLASSIFICATION_CREATE_TEMPLATES_NOT_FOUND } from '@kace/error-codes';

describe('Classification Integration Tests', () => {
    const repository = new KnexClassificationRepository(knexConfig);
    const templateRepository = new KnexTemplatesRepository(repository.connection);
    const classificationTemplateRepository = new KnexClassificationTemplateRelationsRepository(repository.connection);
    const templateIdsValidator = new IdsValidator(repository, templateRepository);

    it('should create a Classification', async () => {
        const dto = ClassificationsMother.dto();
        delete dto.json_flujo;
        // El dto llega al caso de uso sin pasar por `createClassification`, que
        // es quien respalda el flujo y el ans que la factoria inventa.
        await ClassificationsMother.ensureRelations(repository.connection, dto);
        const classificationCreator = new ClassificationCreator(repository);

        await classificationCreator.execute(dto);

        const result = await repository.connection('clasificaciones').select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('creates a classification and its deduplicated template relationships atomically', async () => {
        const firstTemplate = await TemplatesMother.createTemplate(templateRepository);
        const secondTemplate = await TemplatesMother.createTemplate(templateRepository);
        const dto = {
            ...ClassificationsMother.randomDto(),
            template_ids: [firstTemplate.id.value, firstTemplate.id.value, secondTemplate.id.value],
        };
        await ClassificationsMother.ensureRelations(repository.connection, dto);
        const creator = new ClassificationCreator(repository, classificationTemplateRepository, templateIdsValidator);

        await creator.execute(dto);

        const classification = await repository.connection('clasificaciones').where({ id: dto.id }).first();
        // `knex.raw` sobre postgres devuelve el `Result` de pg, no un array de filas.
        const {
            rows: [historyCount],
        } = await repository.connection.raw(
            'SELECT count(*) AS count FROM history_clasificaciones WHERE entity_id = ?',
            [dto.id]
        );
        const relationships = await repository
            .connection('classification_template_relations')
            .where({ classification_id: dto.id })
            .orderBy('template_id');

        expect(classification).toBeDefined();
        expect(Number(historyCount.count)).toBe(1);
        expect(relationships.map(({ template_id }) => template_id)).toEqual(
            [firstTemplate.id.value, secondTemplate.id.value].sort()
        );
    });

    it('allows creating a classification without templates', async () => {
        const dto = { ...ClassificationsMother.randomDto(), template_ids: [] };
        await ClassificationsMother.ensureRelations(repository.connection, dto);
        const creator = new ClassificationCreator(repository, classificationTemplateRepository, templateIdsValidator);

        await creator.execute(dto);

        const classification = await repository.connection('clasificaciones').where({ id: dto.id }).first();
        const relationships = await repository
            .connection('classification_template_relations')
            .where({ classification_id: dto.id });

        expect(classification).toBeDefined();
        expect(relationships).toEqual([]);
    });

    it('rejects unknown template ids before writing the classification', async () => {
        const dto = { ...ClassificationsMother.randomDto(), template_ids: [uuidv4()] };
        const creator = new ClassificationCreator(repository, classificationTemplateRepository, templateIdsValidator);

        await expect(creator.execute(dto)).rejects.toMatchObject({
            publicErrorCode: CLASSIFICATION_CREATE_TEMPLATES_NOT_FOUND,
        });

        const classifications = await repository.connection('clasificaciones').where({ id: dto.id });
        const relationships = await repository
            .connection('classification_template_relations')
            .where({ classification_id: dto.id });
        expect(classifications).toEqual([]);
        expect(relationships).toEqual([]);
    });

    it('rolls back the classification, history, flow relationships, and template relationships together', async () => {
        const subClassification = await ClassificationsMother.createClassification(repository, {
            nivel1: `Sub ${uuidv4()}`,
            json_flujo: null,
        });
        const template = await TemplatesMother.createTemplate(templateRepository);
        const dto = {
            ...ClassificationsMother.randomDto(),
            template_ids: [template.id.value],
        };
        dto.json_flujo = ClassificationsMother.dtoJsonFlow(dto.id, [subClassification.id.value]);
        await ClassificationsMother.ensureRelations(repository.connection, dto);
        const failingRelationshipRepository = {
            save: async (relationship, trx) => {
                await classificationTemplateRepository.save(relationship, trx);
                throw new Error('Injected template relationship failure');
            },
        };
        const creator = new ClassificationCreator(repository, failingRelationshipRepository, templateIdsValidator);

        await expect(creator.execute(dto)).rejects.toThrow('Injected template relationship failure');

        const classifications = await repository.connection('clasificaciones').where({ id: dto.id });
        // `knex.raw` sobre postgres devuelve el `Result` de pg, no un array de filas.
        const {
            rows: [historyCount],
        } = await repository.connection.raw(
            'SELECT count(*) AS count FROM history_clasificaciones WHERE entity_id = ?',
            [dto.id]
        );
        const flowRelationships = await repository
            .connection('classifications_subclassifications_relationships')
            .where({ classification_id: dto.id });
        const templateRelationships = await repository
            .connection('classification_template_relations')
            .where({ classification_id: dto.id });
        expect(classifications).toEqual([]);
        expect(Number(historyCount.count)).toBe(0);
        expect(flowRelationships).toEqual([]);
        expect(templateRelationships).toEqual([]);
    });

    it('should create a Classification with external id and default group', async () => {
        const dto = ClassificationsMother.dto();
        delete dto.json_flujo;
        dto.external_id = 'external-id';
        dto.default_group_id = uuidv4();
        await ClassificationsMother.ensureRelations(repository.connection, dto);
        const classificationCreator = new ClassificationCreator(repository);

        await classificationCreator.execute(dto);

        const result = await repository.connection('clasificaciones').select('*').where('id', dto.id).first();
        expect(result.default_group_id).toEqual(dto.default_group_id);
        expect(result.external_id).toEqual(dto.external_id);
    });

    it('persists and returns folio_config_id, and clears it with an empty string', async () => {
        const dto = ClassificationsMother.dto();
        delete dto.json_flujo;
        dto.folio_config_id = uuidv4();
        await ClassificationsMother.ensureRelations(repository.connection, dto);
        await new ClassificationCreator(repository).execute(dto);

        const row = await repository.connection('clasificaciones').select('*').where('id', dto.id).first();
        expect(row.folio_config_id).toBe(dto.folio_config_id);

        const response = await new ClassificationFinder(repository).execute(dto.id);
        expect(response.toJson().data.folio_config_id).toBe(dto.folio_config_id);

        // The form sends '' to detach the configuration; it has to land as NULL, which is
        // what findByClassificationId reads as "this classification has no folio".
        await new ClassificationUpdater(repository).execute(dto.id, { folio_config_id: '' });

        const cleared = await repository.connection('clasificaciones').select('*').where('id', dto.id).first();
        expect(cleared.folio_config_id).toBeNull();
    });

    it('can get an existing classification', async () => {
        const classification = await ClassificationsMother.createClassification(repository);
        const classificationFinder = new ClassificationFinder(repository);

        const classificationResult = await classificationFinder.execute(classification.id.value);

        expect(classificationResult).not.toBeNull();
        expect(classificationResult).toBeInstanceOf(ClassificationResponse);
    });

    it('can update an existing classification', async () => {
        const base = ClassificationsMother.dto();
        delete base.json_flujo;
        base.nivel1 = 'original level';
        await ClassificationsMother.ensureRelations(repository.connection, base);

        const creator = new ClassificationCreator(repository);
        await creator.execute(base);

        const classificationUpdater = new ClassificationUpdater(repository);
        const newValues = { nivel1: 'updated level' };
        await classificationUpdater.execute(base.id, newValues);

        const result = await new DomainClassificationFinder(repository).execute(base.id);
        expect(result).toBeInstanceOf(Classification);
        expect(result.nivel1.value).toBe(newValues.nivel1);
    });

    it('can delete an existing classification', async () => {
        const classification = await ClassificationsMother.createClassification(repository);
        const classificationDeleter = new ClassificationDeleter(repository);

        await classificationDeleter.execute(classification.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        const result = await repository.find(classification.id);
        expect(result).toBeInstanceOf(Classification);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for Classifications instances with given criteria with filter', async () => {
        for (let i = 0; i < 10; i++) {
            await ClassificationsMother.createClassification(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'is_active',
                    operator: 'eq',
                    value: '1',
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const classificationSearch = new ClassificationSearcher(repository);

        const classificationResult = await classificationSearch.execute(dtoCriteria);
        expect(classificationResult).toBeInstanceOf(ClassificationCollectionResponse);
    });

    it('searches for classifications with criteria that match no records', async () => {
        const dtoCriteria = {
            // El filtro original comparaba `is_active` (boolean en postgres) con
            // '999' y reventaba la consulta en vez de no encontrar nada.
            filter: [
                {
                    field: 'nivel1',
                    operator: 'eq',
                    value: `sin-coincidencias-${uuidv4()}`,
                    type: 'and',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const classificationSearch = new ClassificationSearcher(repository);

        const classificationResult = await classificationSearch.execute(dtoCriteria);
        expect(classificationResult).toBeInstanceOf(ClassificationCollectionResponse);
        expect(classificationResult.toJson().data.items.length).toBe(0);
    });

    it('should return empty when trying to find a classification with a non-existent ID', async () => {
        const classificationFinder = new ClassificationFinder(repository);

        await expect(classificationFinder.execute(uuidv4())).rejects.toThrow(CustomError);
    });

    it('should throw an error when creating a Classification with invalid data', async () => {
        const invalidDto = ClassificationsMother.dto();
        delete invalidDto.id;
        const classificationCreator = new ClassificationCreator(repository);

        await expect(classificationCreator.execute(invalidDto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent classification', async () => {
        const classificationUpdater = new ClassificationUpdater(repository);
        const nonExistentId = uuidv4();
        const newValues = { nivel1: 'updated level' };

        await expect(classificationUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `Classification with ID ${nonExistentId} does not exist.`
        );
    });

    it('should not throw an error when deleting a non-existent classification', async () => {
        const classificationDeleter = new ClassificationDeleter(repository);
        const nonExistentId = uuidv4();

        await expect(
            classificationDeleter.execute(nonExistentId, { deleted_at: new Date().toISOString(), deleted_by: uuidv4() })
        ).rejects.toThrow(`Classification with ID ${nonExistentId} does not exist.`);
    });

    it('should handle creating multiple classifications with the same ID', async () => {
        const dto = ClassificationsMother.dto();
        delete dto.json_flujo;
        await ClassificationsMother.ensureRelations(repository.connection, dto);
        const classificationCreator = new ClassificationCreator(repository);

        await classificationCreator.execute(dto);

        await expect(classificationCreator.execute(dto)).rejects.toThrow(
            `Classification with id ${dto.id} already exists`
        );
    });

    it('should count classifications correctly', async () => {
        const counter = new ClassificationCounter(repository);
        // La semilla deja clasificaciones en la tabla: se cuenta el incremento.
        const initialCount = Number((await counter.execute({ filters: [], relationship: null })).count);

        for (let i = 0; i < 10; i++) {
            await ClassificationsMother.createClassification(repository);
        }

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(initialCount + 10);
    });

    it('should throw an error when creating a Classification with duplicate levels (nivel1 to nivel10)', async () => {
        const dto = ClassificationsMother.randomDto();
        await ClassificationsMother.ensureRelations(repository.connection, dto);
        const classificationCreator = new ClassificationCreator(repository);

        await classificationCreator.execute(dto);

        const duplicateDto = { ...ClassificationsMother.dto(), id: uuidv4() };
        await ClassificationsMother.ensureRelations(repository.connection, duplicateDto);
        duplicateDto.nivel1 = dto.nivel1;
        duplicateDto.nivel2 = dto.nivel2;
        duplicateDto.nivel3 = dto.nivel3;
        duplicateDto.nivel4 = dto.nivel4;
        duplicateDto.nivel5 = dto.nivel5;
        duplicateDto.nivel6 = dto.nivel6;
        duplicateDto.nivel7 = dto.nivel7;
        duplicateDto.nivel8 = dto.nivel8;
        duplicateDto.nivel9 = dto.nivel9;
        duplicateDto.nivel10 = dto.nivel10;

        await expect(classificationCreator.execute(duplicateDto)).rejects.toThrow(ValidationFailError);
    });

    it('should allow creating Classifications with unique combinations of level fields', async () => {
        const dto1 = ClassificationsMother.randomDto();
        // `dto2` copia `dto1`, asi que comparte flujo y ans: con respaldar una
        // vez basta para los dos inserts.
        await ClassificationsMother.ensureRelations(repository.connection, dto1);
        const dto2 = { ...dto1 };
        dto2.id = uuidv4();
        dto2.nivel1 = dto1.nivel1 + '_unique';

        const classificationCreator = new ClassificationCreator(repository);

        await classificationCreator.execute(dto1);
        await expect(classificationCreator.execute(dto2)).resolves.not.toThrow();
    });

    it('should throw an error when creating a Classification with same values up to nivel5 and empty remaining levels', async () => {
        const baseDto = ClassificationsMother.randomDto();
        await ClassificationsMother.ensureRelations(repository.connection, baseDto);
        baseDto.nivel6 = '';
        baseDto.nivel7 = '';
        baseDto.nivel8 = '';
        baseDto.nivel9 = '';
        baseDto.nivel10 = '';

        const classificationCreator = new ClassificationCreator(repository);

        await classificationCreator.execute(baseDto);

        const duplicateDto = { ...baseDto, id: uuidv4() };
        duplicateDto.nivel6 = '';
        duplicateDto.nivel7 = '';
        duplicateDto.nivel8 = '';
        duplicateDto.nivel9 = '';
        duplicateDto.nivel10 = '';

        await expect(classificationCreator.execute(duplicateDto)).rejects.toThrow(ValidationFailError);
    });

    it('should update classification successfully when levels change and uniqueness is maintained', async () => {
        const base = ClassificationsMother.dto();
        delete base.json_flujo;
        await ClassificationsMother.ensureRelations(repository.connection, base);

        const creator = new ClassificationCreator(repository);
        await creator.execute(base);

        const updater = new ClassificationUpdater(repository);

        const newLevels = {
            nivel1: 'newNivel1',
            nivel2: 'newNivel2',
            nivel3: 'newNivel3',
        };

        await expect(updater.execute(base.id, newLevels)).resolves.not.toThrow();

        const updated = await new DomainClassificationFinder(repository).execute(base.id);
        expect(updated.nivel1.value).toBe(newLevels.nivel1);
        expect(updated.nivel2.value).toBe(newLevels.nivel2);
        expect(updated.nivel3.value).toBe(newLevels.nivel3);
    });

    it('should throw error when updating classification with duplicate levels', async () => {
        const classification1 = await ClassificationsMother.createClassification(
            repository,
            ClassificationsMother.randomDto()
        );
        const classification2 = await ClassificationsMother.createClassification(
            repository,
            ClassificationsMother.randomDto()
        );

        const updater = new ClassificationUpdater(repository);

        const duplicateLevels = {
            nivel1: classification1.nivel1.value,
            nivel2: classification1.nivel2.value,
            nivel3: classification1.nivel3.value,
            nivel4: classification1.nivel4.value,
            nivel5: classification1.nivel5.value,
            nivel6: classification1.nivel6.value,
            nivel7: classification1.nivel7.value,
            nivel8: classification1.nivel8.value,
            nivel9: classification1.nivel9.value,
            nivel10: classification1.nivel10.value,
        };

        await expect(updater.execute(classification2.id.value, duplicateLevels)).rejects.toThrow(ValidationFailError);
    });

    it('should auto-fill description by concatenating non-empty levels on create', async () => {
        const dto = ClassificationsMother.dto();
        delete dto.json_flujo;
        await ClassificationsMother.ensureRelations(repository.connection, dto);
        dto.nivel1 = 'CLSS1';
        dto.nivel2 = 'CLSS2';
        dto.nivel3 = 'CLSS3';
        dto.nivel4 = 'CLSS4';
        dto.nivel5 = dto.nivel6 = dto.nivel7 = dto.nivel8 = dto.nivel9 = dto.nivel10 = '';

        const creator = new ClassificationCreator(repository);
        await creator.execute(dto);

        const row = await repository.connection('clasificaciones').select('*').where('id', dto.id).first();

        expect(row).toBeDefined();
        expect(row.description).toBe('CLSS1 -> CLSS2 -> CLSS3 -> CLSS4');
    });

    it('should re-build description on update when some level fields change', async () => {
        const dto = ClassificationsMother.dto();
        delete dto.json_flujo;
        await ClassificationsMother.ensureRelations(repository.connection, dto);
        dto.nivel1 = 'A';
        dto.nivel2 = 'B';
        dto.nivel3 = 'C';
        dto.nivel4 = 'D';
        dto.nivel5 = dto.nivel6 = dto.nivel7 = dto.nivel8 = dto.nivel9 = dto.nivel10 = '';

        const creator = new ClassificationCreator(repository);
        await creator.execute(dto);

        let row = await repository.connection('clasificaciones').select('*').where('id', dto.id).first();
        expect(row.description).toBe('A -> B -> C -> D');

        const updater = new ClassificationUpdater(repository);
        const updateDto = {
            nivel1: 'BB',
            nivel2: 'CC',
            nivel3: 'DD',
        };
        await updater.execute(dto.id, updateDto);

        row = await repository.connection('clasificaciones').select('*').where('id', dto.id).first();

        expect(row).toBeDefined();
        expect(row.description).toBe('BB -> CC -> DD');
    });

    it('should keep description unchanged when update does not touch level fields', async () => {
        const dto = ClassificationsMother.dto();
        delete dto.json_flujo;
        await ClassificationsMother.ensureRelations(repository.connection, dto);
        dto.nivel1 = 'CL1';
        dto.nivel2 = 'CL2';
        dto.nivel3 = dto.nivel4 = dto.nivel5 = dto.nivel6 = dto.nivel7 = dto.nivel8 = dto.nivel9 = dto.nivel10 = '';

        const creator = new ClassificationCreator(repository);
        await creator.execute(dto);

        const before = await repository.connection('clasificaciones').select('*').where('id', dto.id).first();
        expect(before.description).toBe('CL1 -> CL2');
        expect(before.is_active).toBe(true);

        dto.is_active = false;
        const updater = new ClassificationUpdater(repository);
        await updater.execute(dto.id, dto);

        const after = await repository.connection('clasificaciones').select('*').where('id', dto.id).first();

        expect(after.description).toBe('CL1 -> CL2');
        expect(after.is_active).toBe(false);
    });
});
