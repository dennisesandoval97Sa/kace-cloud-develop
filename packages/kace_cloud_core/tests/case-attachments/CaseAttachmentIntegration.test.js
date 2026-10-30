import {
    CaseAttachment,
    CaseAttachmentCreator,
    CaseAttachmentDeleter,
    CaseAttachmentFinder,
    CaseAttachmentUpdater,
    CaseAttachmentSearcher,
    KnexCaseAttachmentRepository,
    CaseAttachmentCollectionResponse,
    CaseAttachmentCounter,
    CaseAttachmentResponse,
} from '../../src/case-attachments/index.js';
import CaseAttachmentMother from './domain/CaseAttachmentMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuid } from 'uuid';
import { CustomError } from '../../src/shared/errors/CustomError.js';
import { KnexCaseRepository } from '../../src/cases/index.js';
import { User } from '../../src/users/index.js';
import UsersMother from '../users/domain/UsersMother.js';

describe('CaseAttachment Integration Tests', () => {
    const repository = new KnexCaseAttachmentRepository(knexConfig);
    const caseRepository = new KnexCaseRepository(repository.connection);
    const currentUser = new User(UsersMother.dto());

    it('should create a CaseAttachment', async () => {
        const dto = CaseAttachmentMother.dto();
        const caseAttachmentCreator = new CaseAttachmentCreator(repository, caseRepository, currentUser);

        await caseAttachmentCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('can get an existing CaseAttachment', async () => {
        const caseAttachment = await CaseAttachmentMother.create(repository);
        const caseAttachmentFinder = new CaseAttachmentFinder(repository);

        const caseAttachmentResult = await caseAttachmentFinder.execute(caseAttachment.id.value);

        expect(caseAttachmentResult).not.toBeNull();
        expect(caseAttachmentResult).toBeInstanceOf(CaseAttachmentResponse);
    });

    it('can update an existing CaseAttachment', async () => {
        const caseAttachment = await CaseAttachmentMother.create(repository);
        const caseAttachmentUpdater = new CaseAttachmentUpdater(repository, caseRepository, currentUser);

        const newValues = { description: 'Updated attachment description' };
        await caseAttachmentUpdater.execute(caseAttachment.id.value, newValues);

        const result = await repository.find(caseAttachment.id);
        expect(result).toBeInstanceOf(CaseAttachment);
        expect(result.description.value).toBe(newValues.description);
    });

    it('should update attachment_type via CaseAttachmentUpdater and persist to DB', async () => {
        const dto = CaseAttachmentMother.dto({ attachment_type: 'Rut' });
        await repository.save(CaseAttachment.create(dto));

        const caseAttachmentUpdater = new CaseAttachmentUpdater(repository, caseRepository, currentUser);
        await caseAttachmentUpdater.execute(dto.id, { attachment_type: 'Cedula del' });

        const result = await repository.find({ value: dto.id });
        expect(result).toBeInstanceOf(CaseAttachment);
        expect(result.attachment_type).toBe('Cedula del');
    });

    it('should update attachment_type to null via CaseAttachmentUpdater', async () => {
        const dto = CaseAttachmentMother.dto({ attachment_type: 'Oferta' });
        await repository.save(CaseAttachment.create(dto));

        const caseAttachmentUpdater = new CaseAttachmentUpdater(repository, caseRepository, currentUser);
        await caseAttachmentUpdater.execute(dto.id, { attachment_type: null });

        const result = await repository.find({ value: dto.id });
        expect(result).toBeInstanceOf(CaseAttachment);
        expect(result.attachment_type).toBeNull();
    });

    it('can delete an existing CaseAttachment', async () => {
        const caseAttachment = await CaseAttachmentMother.create(repository);
        const caseAttachmentDeleter = new CaseAttachmentDeleter(repository, caseRepository, currentUser);

        await caseAttachmentDeleter.execute(caseAttachment.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuid(),
        });

        const result = await repository.find(caseAttachment.id);
        expect(result).toBeInstanceOf(CaseAttachment);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for CaseAttachments with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await CaseAttachmentMother.create(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'deleted_at',
                    operator: 'null',
                    value: '',
                    type: 'AND',
                },
            ],
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: {
                field: 'created_at',
                direction: 'desc',
            },
        };
        const caseAttachmentSearcher = new CaseAttachmentSearcher(repository);

        const searchResult = await caseAttachmentSearcher.execute(dtoCriteria);

        expect(searchResult).toBeInstanceOf(CaseAttachmentCollectionResponse);
    });

    it('should throw an error when creating an existing CaseAttachment', async () => {
        const caseAttachment = await CaseAttachmentMother.create(repository);
        const caseAttachmentCreator = new CaseAttachmentCreator(repository);

        const dto = { ...CaseAttachmentMother.dto(), id: caseAttachment.id.value };
        await expect(caseAttachmentCreator.execute(dto)).rejects.toThrow(
            new CustomError(`CaseAttachment with id ${dto.id} already exists`)
        );
    });

    it('should return null when trying to find a CaseAttachment with a non-existent ID', async () => {
        const caseAttachmentFinder = new CaseAttachmentFinder(repository);
        await expect(caseAttachmentFinder.execute(uuid())).rejects.toThrow(CustomError);
    });

    it('should throw an error when creating a CaseAttachment with invalid data', async () => {
        const dto = CaseAttachmentMother.dto();
        delete dto.id;
        const caseAttachmentCreator = new CaseAttachmentCreator(repository);

        await expect(caseAttachmentCreator.execute(dto)).rejects.toThrow();
    });

    it('should create a CaseAttachment when the file extension case differs from the allowed_file_extensions config', async () => {
        const dto = CaseAttachmentMother.dto({
            path: 'CAROLINA.PNG',
            allowed_file_extensions: ['.pdf', '.png', '.jpg', '.jpeg'],
        });
        const caseAttachmentCreator = new CaseAttachmentCreator(repository, caseRepository, currentUser);

        await caseAttachmentCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('should throw an error when the file extension is not in allowed_file_extensions regardless of case', async () => {
        const dto = CaseAttachmentMother.dto({
            path: 'CAROLINA.EXE',
            allowed_file_extensions: ['.pdf', '.png', '.jpg', '.jpeg'],
        });
        const caseAttachmentCreator = new CaseAttachmentCreator(repository, caseRepository, currentUser);

        await expect(caseAttachmentCreator.execute(dto)).rejects.toThrow('This file extension is not allowed');
    });

    it('should create a CaseAttachment when the allowed_file_extensions config is uppercase and the file extension is lowercase', async () => {
        const dto = CaseAttachmentMother.dto({
            path: 'foto.png',
            allowed_file_extensions: ['.PNG'],
        });
        const caseAttachmentCreator = new CaseAttachmentCreator(repository, caseRepository, currentUser);

        await caseAttachmentCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('should throw an error when trying to update a non-existent CaseAttachment', async () => {
        const caseAttachmentUpdater = new CaseAttachmentUpdater(repository);
        const newValues = { description: 'Updated description' };
        const nonExistentId = uuid();

        await expect(caseAttachmentUpdater.execute(nonExistentId, newValues)).rejects.toThrow(
            `CaseAttachment with ID ${nonExistentId} does not exist.`
        );
    });

    it('should not throw an error when deleting a non-existent CaseAttachment', async () => {
        const caseAttachmentDeleter = new CaseAttachmentDeleter(repository);
        const nonExistentId = uuid();
        await expect(
            caseAttachmentDeleter.execute(nonExistentId, { deleted_at: new Date().toISOString(), deleted_by: uuid() })
        ).rejects.toThrow(`CaseAttachment with ID ${nonExistentId} does not exist.`);
    });

    it('should persist and retrieve attachment_type correctly', async () => {
        const tipoAdjunto = 'Foto lateral';
        const dto = CaseAttachmentMother.dto({ attachment_type: tipoAdjunto });
        await repository.save(CaseAttachment.create(dto));

        const result = await repository.find({ value: dto.id });
        expect(result).toBeInstanceOf(CaseAttachment);
        expect(result.attachment_type).toBe(tipoAdjunto);
    });

    it('should persist attachment_type as null when not provided', async () => {
        const dto = CaseAttachmentMother.dto({ attachment_type: null });
        await repository.save(CaseAttachment.create(dto));

        const result = await repository.find({ value: dto.id });
        expect(result).toBeInstanceOf(CaseAttachment);
        expect(result.attachment_type).toBeNull();
    });

    it('should include attachment_type in CaseAttachmentResponse.toJson()', async () => {
        const tipoAdjunto = 'Foto trasera';
        const caseAttachment = CaseAttachment.create(CaseAttachmentMother.dto({ attachment_type: tipoAdjunto }));
        await repository.save(caseAttachment);

        const caseAttachmentFinder = new CaseAttachmentFinder(repository);
        const response = await caseAttachmentFinder.execute(caseAttachment.id.value);
        const json = response.toJson();

        expect(json.data.attachment_type).toBe(tipoAdjunto);
    });

    it('should count CaseAttachment instances correctly', async () => {
        for (let i = 0; i < 10; i++) {
            await CaseAttachmentMother.create(repository);
        }
        const counter = new CaseAttachmentCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(10);
    });
});
