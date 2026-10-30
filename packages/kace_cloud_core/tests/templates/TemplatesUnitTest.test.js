import { Template, TemplateResponse, Types } from '../../src/templates/index.js';
import { v4 as uuidv4 } from 'uuid';
import { InvalidArgumentError, ValueObjectStatus, ValueObjectUuid } from '../../src/shared/index.js';
import TemplatesMother from './domain/TemplatesMother.js';
import { TemplatesCollectionResponse } from '../../src/templates/index.js';
import { UuidError } from '../../src/shared/errors/UuidError.js';
import { SQL_BLACKLIST_WORD_DETECTED, TEMPLATE_INVALID_TYPE } from '@kace/error-codes';

describe('Template Entity', () => {
    const dto = TemplatesMother.dto();

    it('should create a template with valid data', () => {
        const template = Template.create(dto);
        expect(template.id).toBeInstanceOf(ValueObjectUuid);
        expect(template.status).toBeInstanceOf(ValueObjectStatus);
    });

    it('should expose whether the template sends case attachments', () => {
        const template = Template.create({
            ...dto,
            enviar_adjuntos_del_caso: true,
        });

        expect(template.enviar_adjuntos_del_caso.value).toBe(true);
    });

    it('should update template data', () => {
        const template = Template.create(dto);
        const newData = {
            descripcion: 'Updated descripcion',
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        template.update(newData);
        expect(template.descripcion.value).toBe('Updated descripcion');
        expect(template.changedAttributes).toEqual(newData);
    });

    it('should throw a UuidError with invalid UUID', () => {
        const invalidData = { ...dto, id: 'invalid-uuid' };

        expect(() => Template.create(invalidData)).toThrowError(UuidError);
    });

    it('tags SQL blacklist validation errors with the public error code', () => {
        const invalidData = TemplatesMother.dto({
            descripcion: "invoice'; SELECT FROM users; --",
        });

        // El SQLInjectionGuard solo bloquea en modo enforce, y la corrida hereda
        // SQL_GUARD_MODE=observe del .env de la raiz que carga jest.config.js.
        // Este test describe el modo enforce, asi que lo fija el mismo en vez de
        // depender del entorno ambiente.
        const previousGuardMode = process.env.SQL_GUARD_MODE;
        process.env.SQL_GUARD_MODE = 'enforce';

        let error;
        try {
            Template.create(invalidData);
        } catch (caughtError) {
            error = caughtError;
        } finally {
            if (previousGuardMode === undefined) {
                delete process.env.SQL_GUARD_MODE;
            } else {
                process.env.SQL_GUARD_MODE = previousGuardMode;
            }
        }

        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.publicErrorCode).toBe(SQL_BLACKLIST_WORD_DETECTED);
    });
});

describe('Template Tests', () => {
    it('creates a new Template instance from DTO', () => {
        const dto = TemplatesMother.dto();
        dto.updated_at = null;
        dto.updated_by = null;
        dto.deleted_at = null;
        dto.deleted_by = null;
        const template = Template.create(dto);
        expect(template.id.value).toBe(dto.id);
        expect(template.descripcion.value).toBe(dto.descripcion);
        expect(template.status.value).toBe(dto.status);
        expect(template.created_at.value).toBe(dto.created_at);
        expect(template.updated_at.value).toBe(dto.updated_at);
        expect(template.created_by.value).toBe(dto.created_by);
        expect(template.updated_by.value).toBe(dto.updated_by);
        expect(template.deleted_at.value).toBe(dto.deleted_at);
        expect(template.deleted_by.value).toBe(dto.deleted_by);
    });

    it('updates an Template instance with new values', () => {
        const dto = TemplatesMother.dto();
        const template = Template.create(dto);
        const updateDto = {
            descripcion: 'Updated Name',
            status: 2,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        template.update(updateDto);
        expect(template.descripcion.value).toBe(updateDto.descripcion);
        expect(template.status.value).toBe(updateDto.status);
        expect(template.updated_at.value).toBe(updateDto.updated_at);
        expect(template.updated_by.value).toBe(updateDto.updated_by);
    });

    it('does not update properties when values are the same', () => {
        const dto = TemplatesMother.dto();
        const template = Template.create(dto);
        template.update(dto);
        expect(template.changedAttributes).toEqual({});
    });

    it('marks an Template instance as deleted', () => {
        const dto = TemplatesMother.dto();
        const template = Template.create(dto);
        const deleteDto = {
            deleted_at: new Date().toISOString(),
            deleted_by: uuidv4(),
        };
        template.delete(deleteDto);
        expect(template.deleted_at.value).toBe(deleteDto.deleted_at);
        expect(template.deleted_by.value).toBe(deleteDto.deleted_by);
    });

    it('flushes changes in Template instance', () => {
        const dto = TemplatesMother.dto();
        const template = Template.create(dto);
        const updateDto = {
            descripcion: 'Updated Name',
            status: 2,
            updated_at: new Date().toISOString(),
            updated_by: uuidv4(),
        };
        template.update(updateDto);
        template.flushChanges();
        expect(template.changedAttributes).toEqual({});
    });
});

describe('Template Responses Tests', () => {
    it('converts Template object to JSON representation', () => {
        const template = new Template(TemplatesMother.randomDto());
        const templateResponse = new TemplateResponse(template);
        const json = templateResponse.toJson();
        expect(json).toEqual({
            data: {
                id: template.id.value,
                descripcion: template.descripcion.value,
                ruta: template.ruta.value,
                tipo: template.tipo.value,
                destinatario: template.destinatario.value,
                copia: template.copia.value,
                copia_oculta: template.copia_oculta.value,
                asunto: template.asunto.value,
                cuerpo: template.cuerpo.value,
                incluye_adjuntos: template.incluye_adjuntos.value,
                enviar_adjuntos_del_caso: template.enviar_adjuntos_del_caso.value,
                status: template.status.value,
                created_at: template.created_at.value,
                updated_at: template.updated_at.value,
                created_by: template.created_by.value,
                updated_by: template.updated_by.value,
            },
        });
    });

    it('converts TemplateCollection to JSON representation', () => {
        const templateCollection = [
            new Template(TemplatesMother.randomDto()),
            new Template(TemplatesMother.randomDto()),
        ];
        const templatesCollectionResponse = new TemplatesCollectionResponse(
            templateCollection,
            templateCollection.length
        );
        const json = templatesCollectionResponse.toJson();
        expect(json).toEqual({
            data: {
                items: templateCollection.map((template) => new TemplateResponse(template).toJson().data),
            },
            metadata: {
                count: templateCollection.length,
            },
        });
    });

    it('throws error when value is null', () => {
        expect(() => {
            new Types('TEST', null);
        }).toThrow('The value cannot be null');
    });

    it('throws error when value is invalid', () => {
        let error;
        try {
            new Types('TEST', 'InvalidValue');
        } catch (caughtError) {
            error = caughtError;
        }

        expect(error).toBeInstanceOf(InvalidArgumentError);
        expect(error.message).toBe('The value must be a valid Type: InvalidValue');
        expect(error.publicErrorCode).toBe(TEMPLATE_INVALID_TYPE);
    });
});
