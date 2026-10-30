import {
    Classification,
    ClassificationCreator,
    ClassificationDeleter,
    ClassificationFinder,
    ClassificationUpdater,
    KnexClassificationRepository,
    ClassificationsValidator,
} from '../../src/classifications';
import ClassificationsMother from './domain/ClassificationsMother';
import { knexConfig } from '../knexfile.js';
import { v4 as uuidv4 } from 'uuid';
import { ValidationFailError } from '../../src/shared/index.js';

describe('Classifications flows integrations Test', () => {
    const repository = new KnexClassificationRepository(knexConfig);
    const repositoryPostgres = new KnexClassificationRepository(knexConfig);

    it('Should return false value if least one classification does not exist', async () => {
        const classification1 = await ClassificationsMother.create(repository);
        const classification2 = await ClassificationsMother.create(repository);
        const classification3 = await ClassificationsMother.create(repository);

        const classificationValidator = new ClassificationsValidator(repository);
        const id = uuidv4();

        const ids = [id, classification1.id.value, classification2.id.value, classification3.id.value, id];
        const validationResult = await classificationValidator.execute(ids);

        expect(validationResult).toBe(false);
    });

    it('Should return true value if all classifications exists', async () => {
        const classification1 = await ClassificationsMother.create(repository);
        const classification2 = await ClassificationsMother.create(repository);
        const classification3 = await ClassificationsMother.create(repository);
        const classification = await ClassificationsMother.create(repository);
        const classificationValidator = new ClassificationsValidator(repository);

        const ids = [
            classification1.id.value,
            classification2.id.value,
            classification3.id.value,
            classification.id.value,
        ];
        const validationResult = await classificationValidator.execute(ids);

        expect(validationResult).toBe(true);
    });

    it('ClassificationsCreator save classifications and subclassifications relations', async () => {
        const subclassifications = [
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
        ];

        const dto = ClassificationsMother.dto({ sub_classification_ids: subclassifications.map((s) => s.id.value) });
        // El dto va al caso de uso sin pasar por `create`, que es quien
        // respalda el flujo y el ans que la factoria inventa.
        await ClassificationsMother.ensureRelations(repository.connection, dto);

        const classificationsCreator = new ClassificationCreator(repository);

        dto.updated_at = new Date().toISOString();
        dto.updated_by = uuidv4();
        await classificationsCreator.execute(dto);

        const result = await repository.connection('classifications_subclassifications_relationships').select('*');

        expect(result.length).toBe(dto.json_flujo.edges.length);
    });

    it('ClassificationsCreator create classifications json_flow property', async () => {
        const subclassifications = [
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
        ];

        const dto = ClassificationsMother.dto({ sub_classification_ids: subclassifications.map((s) => s.id.value) });
        await ClassificationsMother.ensureRelations(repository.connection, dto);

        const classificationsFlowCreator = new ClassificationCreator(repository);

        await classificationsFlowCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where({ id: dto.id });

        expect(result.length).toBe(1);
        expect(result[0].json_flujo).toEqual(dto.json_flujo);
    });

    it('ClassificationsCreator trhow error when relation does not exist', async () => {
        const subclassifications = [
            { id: { value: uuidv4() } },
            { id: { value: uuidv4() } },
            { id: { value: uuidv4() } },
            { id: { value: uuidv4() } },
            { id: { value: uuidv4() } },
        ];

        const dto = ClassificationsMother.dto({ sub_classification_ids: subclassifications.map((s) => s.id.value) });

        const classificationsCreator = new ClassificationCreator(repository);

        await expect(classificationsCreator.execute(dto)).rejects.toThrow(ValidationFailError);
    });

    it('Finder service return a classification with json_flujo property', async () => {
        const subclassifications = [
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
        ];

        const classifications = await ClassificationsMother.create(repository, {
            sub_classification_ids: subclassifications.map((s) => s.id.value),
        });

        const classificationFinder = new ClassificationFinder(repository);

        const classificationsResult = await classificationFinder.execute(classifications.id.value);

        const result = classificationsResult.toJson();
        expect(result.data.json_flujo).toEqual(classifications.json_flujo.value);
    });

    it('ClassificationFinder return classifications realtions', async () => {
        const subclassifications = [
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
        ];

        const classificationsIds = {
            sub_classification_ids: subclassifications.map((s) => s.id.value),
        };

        const classifications = await ClassificationsMother.create(repository, classificationsIds);
        const classificationsRelations = new ClassificationFinder(repository);

        const classificationsResult = await classificationsRelations.execute(classifications.id.value);

        const result = classificationsResult.toJson();

        // `KnexClassificationRepository.find` rellena `relations` con las
        // clasificaciones relacionadas completas (no con pares
        // {classification_id, sub_classification_id}), y `ClassificationResponse`
        // prefiere ese valor sobre `getClassificationRelations()`.
        expect(result.data).toHaveProperty('relations');
        expect(result.data.relations.map((relation) => relation.id).sort()).toEqual(
            classifications.getClassificationsIds().sort()
        );
    });

    it('Delete Classifications relationships', async () => {
        const subclassifications = [
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
            await ClassificationsMother.create(repository),
        ];

        const classificationsIds = {
            sub_classification_ids: subclassifications.map((s) => s.id.value),
        };

        const classifications = await ClassificationsMother.create(repository, classificationsIds);

        const classificationsDeleter = new ClassificationDeleter(repository);

        const dto = { deleted_at: new Date().toISOString(), deleted_by: uuidv4() };
        await classificationsDeleter.execute(classifications.id.value, dto);

        const deleted = await repository.connection('classifications_subclassifications_relationships').select('*');
        expect(deleted.length).toBe(0);
    });

    it('ClassificationsUpdater must update classifications json_flow property', async () => {
        const subclassifications = [
            await ClassificationsMother.create(repositoryPostgres),
            await ClassificationsMother.create(repositoryPostgres),
        ];
        const classificationsIds = {
            sub_classification_ids: subclassifications.map((s) => s.id.value),
        };
        const classification = await ClassificationsMother.create(repositoryPostgres, classificationsIds);

        const classificationsUpdater = new ClassificationUpdater(repositoryPostgres);

        const updatedSubclassifications = [
            await ClassificationsMother.create(repositoryPostgres),
            await ClassificationsMother.create(repositoryPostgres),
            await ClassificationsMother.create(repositoryPostgres),
            await ClassificationsMother.create(repositoryPostgres),
            await ClassificationsMother.create(repositoryPostgres),
        ];
        const updatedClassificationsIds = {
            id: classification.id.value,
            sub_classification_ids: updatedSubclassifications.map((s) => s.id.value),
        };
        const updatedDto = ClassificationsMother.dto(updatedClassificationsIds);
        // El update reescribe `flujo_id` y `ans_id` con los nuevos que inventa
        // el dto, asi que la clave foranea tambien se comprueba al actualizar.
        await ClassificationsMother.ensureRelations(repositoryPostgres.connection, updatedDto);
        updatedDto.updated_at = new Date().toISOString();
        updatedDto.updated_by = uuidv4();
        await classificationsUpdater.execute(updatedDto.id, updatedDto);

        const classificationsFinder = new ClassificationFinder(repositoryPostgres);
        const classificationsResult = await classificationsFinder.execute(updatedDto.id);
        const result = classificationsResult.toJson();

        const updatedClassifications = Classification.create(updatedDto);

        // Ver el test anterior: `relations` son las clasificaciones relacionadas,
        // no los pares del flujo.
        expect(result.data.relations.map((relation) => relation.id).sort()).toEqual(
            updatedClassifications.getClassificationsIds().sort()
        );
        expect(result.data.json_flujo).toEqual(updatedDto.json_flujo);
    });
});
