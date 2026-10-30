import { v4 as uuidv4 } from 'uuid';
import { Template } from '../../../src/templates/index.js';
import Chance from 'chance';
import TestHelper from '../../TestHelper.js';

export default class TemplatesMother {
    /**
     * Generates a Data Transfer Object (DTO) for the `Template` entity.
     *
     * @returns {Object} The DTO containing the properties for an `Template` entity.
     */
    static dto(overrides = {}) {
        const id = uuidv4();
        return {
            id,
            descripcion: `Lorem Ipsum ${id}`,
            ruta: null,
            tipo: 1,
            destinatario: 'correo@test.com',
            copia: null,
            copia_oculta: null,
            asunto: 'Lorem Ipsum',
            cuerpo: 'Lorem Ipsum is simply dummy text of the printing and typesetting industry.',
            incluye_adjuntos: true,
            enviar_adjuntos_del_caso: false,
            status: 1,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            ...overrides,
        };
    }

    /**
     * Creates an `Template` instance and saves it to the repository.
     *
     * @param {KnexTemplateRepository} repository - The repository to save the `Template` instance.
     * @returns {Template} The created `Template` instance.
     */
    static async createTemplate(repository, overrides = {}) {
        const template = Template.create(TemplatesMother.dto(overrides));
        await repository.save(template);
        return template;
    }

    /**
     * Generates a random Data Transfer Object (DTO) for the `Template` entity.
     *
     * @returns {Object} The DTO containing random properties for an `Template` entity.
     */
    static randomDto() {
        const chance = new Chance();

        const descripcion = TestHelper.generateSafeValue(() => chance.string({ alpha: true }));

        return {
            id: uuidv4(),
            descripcion: `descripcion${descripcion}`,
            tipo: 1,
            destinatario: TestHelper.generateSafeValue(() => chance.email()),
            copia: TestHelper.generateSafeValue(() => chance.email()),
            copia_oculta: TestHelper.generateSafeValue(() => chance.email()),
            asunto: 'Asunto de prueba',
            cuerpo: 'Cuerpo de prueba',
            ruta: TestHelper.generateSafeValue(() => chance.url()),
            incluye_adjuntos: chance.bool(),
            enviar_adjuntos_del_caso: chance.bool(),
            status: chance.integer({ min: 1, max: 2 }),
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
        };
    }

    /**
     * Creates an `Template` instance with random properties and saves it to the repository.
     *
     * @param {KnexTemplateRepository} repository - The repository to save the `Template` instance.
     * @returns {Template} The created `Template` instance.
     */
    static async createRandomTemplate(repository) {
        const template = Template.create(TemplatesMother.randomDto());
        await repository.save(template);
        return template;
    }
}
