import {
    TemplateAttachment,
    TemplateAttachmentCreator,
    TemplateAttachmentDeleter,
    TemplateAttachmentFinder,
    TemplateAttachmentUpdater,
    TemplateAttachmentSearcher,
    KnexTemplateAttachmentRepository,
    TemplateAttachmentCollectionResponse,
    TemplateAttachmentCounter,
    TemplateAttachmentResponse,
} from '../../src/template-attachments/index.js';
import TemplateAttachmentMother from './domain/TemplateAttachmentMother.js';
import { knexConfig } from '../knexfile.js';
import { v4 as uuid } from 'uuid';
import { CustomError } from '../../src/shared/errors/CustomError.js';

describe('TemplateAttachment Integration Tests', () => {
    const repository = new KnexTemplateAttachmentRepository(knexConfig);

    it('should create a TemplateAttachment', async () => {
        // `TemplateAttachmentCreator` valida la extension del `path` contra la
        // lista que le llega en el dto; sin ella revienta al leer `.includes`.
        const dto = { ...TemplateAttachmentMother.dto(), allowed_file_extensions: ['.pdf'] };
        const templateAttachmentCreator = new TemplateAttachmentCreator(repository);

        await templateAttachmentCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('should create a TemplateAttachment when the file extension case differs from allowed_file_extensions', async () => {
        const dto = {
            ...TemplateAttachmentMother.dto({ path: 'CAROLINA.PDF' }),
            allowed_file_extensions: ['.pdf'],
        };
        const templateAttachmentCreator = new TemplateAttachmentCreator(repository);

        await templateAttachmentCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('should create a TemplateAttachment when the allowed_file_extensions config is uppercase and the file extension is lowercase', async () => {
        const dto = {
            ...TemplateAttachmentMother.dto({ path: 'sample.pdf' }),
            allowed_file_extensions: ['.PDF'],
        };
        const templateAttachmentCreator = new TemplateAttachmentCreator(repository);

        await templateAttachmentCreator.execute(dto);

        const result = await repository.connection(repository.tableName).select('*').where('id', dto.id);

        expect(result.length).toBe(1);
    });

    it('should throw an error when the file extension is not in allowed_file_extensions regardless of case', async () => {
        const dto = {
            ...TemplateAttachmentMother.dto({ path: 'CAROLINA.EXE' }),
            allowed_file_extensions: ['.pdf'],
        };
        const templateAttachmentCreator = new TemplateAttachmentCreator(repository);

        await expect(templateAttachmentCreator.execute(dto)).rejects.toThrow('This file extension is not allowed');
    });

    it('can get an existing TemplateAttachment', async () => {
        const templateAttachment = await TemplateAttachmentMother.create(repository);
        const templateAttachmentFinder = new TemplateAttachmentFinder(repository);

        const templateAttachmentResult = await templateAttachmentFinder.execute(templateAttachment.id.value);

        expect(templateAttachmentResult).not.toBeNull();
        expect(templateAttachmentResult).toBeInstanceOf(TemplateAttachmentResponse);
    });

    it('can update an existing TemplateAttachment', async () => {
        const templateAttachment = await TemplateAttachmentMother.create(repository);
        const templateAttachmentUpdater = new TemplateAttachmentUpdater(repository);

        const newValues = { path: 'Updated attachment path' };
        await templateAttachmentUpdater.execute(templateAttachment.id.value, newValues);

        const result = await repository.find(templateAttachment.id);
        expect(result).toBeInstanceOf(TemplateAttachment);
        expect(result.path.value).toBe(newValues.path);
    });

    it('can delete an existing TemplateAttachment', async () => {
        const templateAttachment = await TemplateAttachmentMother.create(repository);
        const templateAttachmentDeleter = new TemplateAttachmentDeleter(repository);

        await templateAttachmentDeleter.execute(templateAttachment.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuid(),
        });

        const result = await repository.find(templateAttachment.id);
        expect(result).toBeInstanceOf(TemplateAttachment);
        expect(result.deleted_at.value).not.toBeNull();
        expect(result.deleted_by.value).not.toBeNull();
    });

    it('searches for TemplateAttachments with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await TemplateAttachmentMother.create(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const templateAttachmentSearcher = new TemplateAttachmentSearcher(repository);

        const searchResult = await templateAttachmentSearcher.execute(dtoCriteria);

        expect(searchResult).toBeInstanceOf(TemplateAttachmentCollectionResponse);
    });

    it('should throw an error when creating an existing TemplateAttachment', async () => {
        const templateAttachment = await TemplateAttachmentMother.create(repository);
        const templateAttachmentCreator = new TemplateAttachmentCreator(repository);

        const dto = {
            ...TemplateAttachmentMother.dto(),
            id: templateAttachment.id.value,
            allowed_file_extensions: ['.pdf'],
        };
        await expect(templateAttachmentCreator.execute(dto)).rejects.toThrow(
            new CustomError(`TemplateAttachment with id ${dto.id} already exists`)
        );
    });

    it('should return null when trying to find a TemplateAttachment with a non-existent ID', async () => {
        const templateAttachmentFinder = new TemplateAttachmentFinder(repository);

        await expect(templateAttachmentFinder.execute(uuid())).rejects.toThrow(CustomError);
    });

    it('should throw an error when creating a TemplateAttachment with invalid data', async () => {
        const dto = TemplateAttachmentMother.dto();
        delete dto.id;
        const templateAttachmentCreator = new TemplateAttachmentCreator(repository);

        await expect(templateAttachmentCreator.execute(dto)).rejects.toThrow();
    });

    it('should throw an error when trying to update a non-existent TemplateAttachment', async () => {
        const templateAttachmentUpdater = new TemplateAttachmentUpdater(repository);
        const newValues = { description: 'Updated description' };
        const nonExistentId = uuid();

        await expect(templateAttachmentUpdater.execute(nonExistentId, newValues)).rejects.toThrow(CustomError);
    });

    it('should not throw an error when deleting a non-existent TemplateAttachment', async () => {
        const templateAttachmentDeleter = new TemplateAttachmentDeleter(repository);
        const nonExistentId = uuid();
        await expect(
            templateAttachmentDeleter.execute(nonExistentId, {
                deleted_at: new Date().toISOString(),
                deleted_by: uuid(),
            })
        ).rejects.toThrow(CustomError);
    });

    it('should count TemplateAttachment instances correctly', async () => {
        for (let i = 0; i < 10; i++) {
            await TemplateAttachmentMother.create(repository);
        }
        const counter = new TemplateAttachmentCounter(repository);

        const count = await counter.execute({ filters: [], relationship: null });
        expect(Number(count.count)).toBe(10);
    });
});
