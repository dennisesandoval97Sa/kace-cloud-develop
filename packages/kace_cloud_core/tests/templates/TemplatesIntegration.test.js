import TemplatesMother from './domain/TemplatesMother.js';
import {
    Template,
    TemplateCreator,
    TemplateDeleter,
    TemplateFinder,
    TemplateResponse,
    TemplatesSearcher,
    TemplateUpdater,
    KnexTemplatesRepository,
} from '../../src/templates/index.js';
import { v4 as uuidv4 } from 'uuid';
import { knexConfig } from '../knexfile.js';
import { InvalidArgumentError } from '../../src/shared/errors/InvalidArgumentError.js';
import { TemplatesCollectionResponse } from '../../src/templates/application/TemplatesCollectionResponse.js';
import { Counter } from '../../src/shared/domain/Counter.js';

describe('TemplateCreator', () => {
    const repository = new KnexTemplatesRepository(knexConfig);

    it('should create a Template', async () => {
        const dto = TemplatesMother.randomDto();
        const templateCreator = new TemplateCreator(repository);
        await templateCreator.execute(dto);
        const result = await repository.connection('plantillas').select('*').where('id', dto.id);
        expect(result.length).toBe(1);
    });

    it('can i get a existing template', async () => {
        const template = await TemplatesMother.createTemplate(repository);
        const templateFinder = new TemplateFinder(repository);
        const templateResult = await templateFinder.execute(template.id.value);
        expect(templateResult).not.toBeNull();
        expect(templateResult).toBeInstanceOf(TemplateResponse);
    });

    it('can update a existing template', async () => {
        const template = await TemplatesMother.createRandomTemplate(repository);
        const templateUpdater = new TemplateUpdater(repository);
        const data = {
            descripcion: `Lorem Ipsum ${template.id.value}`,
            ruta: 'path/path2',
            tipo: 1,
            destinatario: 'correo@test.com',
            copia: 'correo@test.com',
            copia_oculta: 'correo2@test.com',
            asunto: 'Lorem Ipsum',
            cuerpo: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.',
            incluye_adjuntos: true,
            enviar_adjuntos_del_caso: true,
        };
        await templateUpdater.execute(template.id.value, data);
        const result = await repository.find(template.id);
        expect(result).toBeInstanceOf(Template);
        expect(result.descripcion.value).toBe(`Lorem Ipsum ${template.id.value}`);
        expect(result.enviar_adjuntos_del_caso.value).toBe(true);
    });

    it('can update tipo from a existing template', async () => {
        const template = await TemplatesMother.createRandomTemplate(repository);
        const templateUpdater = new TemplateUpdater(repository);
        const data = {
            tipo: 2,
        };
        await templateUpdater.execute(template.id.value, data);
        const result = await repository.find(template.id);
        expect(result).toBeInstanceOf(Template);
        expect(result.tipo.value).toBe(data.tipo);
    });

    it('can update tipo from a existing template', async () => {
        const template = await TemplatesMother.createTemplate(repository);
        const templateUpdater = new TemplateUpdater(repository);
        const data = {
            incluye_adjuntos: false,
        };
        await templateUpdater.execute(template.id.value, data);
        const result = await repository.find(template.id);
        expect(result).toBeInstanceOf(Template);
        expect(result.incluye_adjuntos.value).toBe(data.incluye_adjuntos);
    });

    it('can update enviar_adjuntos_del_caso from an existing template', async () => {
        const template = await TemplatesMother.createTemplate(repository, {
            enviar_adjuntos_del_caso: false,
        });
        const templateUpdater = new TemplateUpdater(repository);
        const data = {
            enviar_adjuntos_del_caso: true,
        };
        await templateUpdater.execute(template.id.value, data);
        const result = await repository.find(template.id);
        expect(result).toBeInstanceOf(Template);
        expect(result.enviar_adjuntos_del_caso.value).toBe(true);
    });

    it('searches for Template instances with given criteria', async () => {
        for (let i = 0; i < 10; i++) {
            await TemplatesMother.createTemplate(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const TemplatesSearch = new TemplatesSearcher(repository);
        const TemplatesResult = await TemplatesSearch.execute(dtoCriteria);
        expect(TemplatesResult).toBeInstanceOf(TemplatesCollectionResponse);

        expect(Number(TemplatesResult.toJson().metadata.count)).toEqual(10);
    });

    it('searches for Template instances with given criteria with filter', async () => {
        for (let i = 0; i < 10; i++) {
            await TemplatesMother.createRandomTemplate(repository);
        }
        const dtoCriteria = {
            filter: [
                {
                    field: 'status',
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
        const TemplatesSearch = new TemplatesSearcher(repository);
        const TemplatesResult = await TemplatesSearch.execute(dtoCriteria);
        expect(TemplatesResult).toBeInstanceOf(TemplatesCollectionResponse);
    });

    it('counter for Template instances with given criteria', async () => {
        // El `await` faltaba: las diez creaciones quedaban en vuelo y el contador
        // leia la tabla a medio sembrar, de ahi el "7" que devolvia postgres.
        for (let i = 0; i < 10; i++) {
            await TemplatesMother.createRandomTemplate(repository);
        }
        const dtoCriteria = {
            filter: undefined,
            relationship: undefined,
            limit: 10,
            offset: 0,
            order: { field: 'created_at', direction: 'asc' },
        };
        const templateCount = new Counter(repository);
        const templateResult = await templateCount.execute(dtoCriteria);

        expect(Number(templateResult)).toEqual(10);
    });

    it('return null if not found a record', async () => {
        const templateFinder = new TemplateFinder(repository);
        const templateResult = await templateFinder.execute(uuidv4());
        expect(templateResult).not.toBeNull();
        expect(templateResult).toBeInstanceOf(TemplateResponse);
    });

    it('can delete a existing template', async () => {
        const template = await TemplatesMother.createTemplate(repository);
        const templateDeleter = new TemplateDeleter(repository);
        await templateDeleter.execute(template.id.value, {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        });

        const result = await repository.find(template.id);
        expect(result).toBeNull();
    });

    it('should throw an error when tipo value is null', async () => {
        const dto = TemplatesMother.dto();
        const templateCreator = new TemplateCreator(repository);
        dto.tipo = null;
        await expect(templateCreator.execute(dto)).rejects.toThrow(
            new InvalidArgumentError('Invalid type value: null')
        );
    });

    it('should throw an error when tipo value is invalid', async () => {
        const dto = TemplatesMother.dto();
        const templateCreator = new TemplateCreator(repository);
        dto.tipo = 4;
        await expect(templateCreator.execute(dto)).rejects.toThrow(new InvalidArgumentError('Invalid type value: 4'));
    });

    it('should generate a default value when destinatario value is null', async () => {
        const dto = TemplatesMother.dto();
        const templateCreator = new TemplateCreator(repository);
        dto.destinatario = null;

        await templateCreator.execute(dto);
        const templateFinder = new TemplateFinder(repository);
        const templateResult = await templateFinder.execute(dto.id);
        const template = templateResult.toJson();
        expect(template.data.destinatario).toBe('default@default.com');
    });

    it('should throw an error when creating a Template with duplicate field', async () => {
        const dto1 = TemplatesMother.dto();
        const dto2 = TemplatesMother.dto();
        dto2.descripcion = dto1.descripcion;

        const templateCreator = new TemplateCreator(repository);

        await templateCreator.execute(dto1);

        await expect(templateCreator.execute(dto2)).rejects.toThrow(
            `The following value(s) already exist: descripcion '${dto1.descripcion}'.`
        );
    });

    it('should throw an error when updating a Template to have duplicate field', async () => {
        const template1 = await TemplatesMother.createTemplate(repository);
        const template2 = await TemplatesMother.createTemplate(repository);

        const templateUpdater = new TemplateUpdater(repository);

        await expect(
            templateUpdater.execute(template2.id.value, { descripcion: template1.descripcion.value })
        ).rejects.toThrow(`The following value(s) already exist: descripcion '${template1.descripcion.value}'.`);
    });
});
