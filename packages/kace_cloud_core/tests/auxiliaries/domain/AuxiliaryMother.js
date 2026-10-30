import { v4 as uuidv4 } from 'uuid';
import { Auxiliary } from '../../../src/auxiliaries/domain/Auxiliary';

export class AuxiliaryMother {
    /**
     * Genera un DTO genérico para pruebas de auxiliares
     * @param {object} options - Opciones para personalizar el DTO
     * @param {string} [options.id] - ID personalizado
     * @param {object} [options.data] - Datos personalizados para el registro
     * @param {Date} [options.created_at] - Fecha de creación personalizada
     * @param {string} [options.created_by] - ID del usuario que creó el registro
     * @param {Date} [options.updated_at] - Fecha de actualización personalizada
     * @param {string} [options.updated_by] - ID del usuario que actualizó el registro
     * @param {Date} [options.deleted_at] - Fecha de eliminación personalizada
     * @param {string} [options.deleted_by] - ID del usuario que eliminó el registro
     * @returns {object} DTO generado
     */
    static dto({ id, data, created_at, created_by, updated_at, updated_by, deleted_at, deleted_by } = {}) {
        return {
            id: id ?? uuidv4(),
            data: data ?? {
                nombre: 'Test Auxiliary',
                descripcion: 'Test Description',
                codigo: 'TEST-001',
                estado: 'activo',
                tipo: 'general',
            },
            created_at: created_at ?? new Date().toISOString(),
            created_by: created_by ?? uuidv4(),
            updated_at: updated_at ?? null,
            updated_by: updated_by ?? null,
            deleted_at: deleted_at ?? null,
            deleted_by: deleted_by ?? null,
        };
    }

    /**
     * Crea y guarda un registro de auxiliar en la base de datos
     * @param {KnexAuxiliariesRepository} repository - Repositorio para guardar el registro
     * @param {string} tableName - Nombre de la tabla donde se guardará el registro
     * @param {object} overrides - Datos para sobrescribir el DTO por defecto
     * @returns {Promise<object>} El registro guardado
     */
    static async create(repository, tableName, overrides = {}) {
        const auxiliary = new Auxiliary(this.dto(overrides));
        await repository.save(auxiliary, tableName);
        return auxiliary;
    }

    /**
     * Genera múltiples DTOs para pruebas
     * @param {number} count - Número de DTOs a generar
     * @param {object} baseData - Datos base para todos los DTOs
     * @returns {object[]} Array de DTOs generados
     */
    static generateMultiple(count, baseData = {}) {
        return Array.from({ length: count }, (_, index) => {
            const data = {
                ...baseData,
                nombre: `${baseData.nombre ?? 'Test Auxiliary'} ${index + 1}`,
                codigo: `${baseData.codigo ?? 'TEST'}-${String(index + 1).padStart(3, '0')}`,
            };
            return this.dto({ data });
        });
    }

    /**
     * Crea y guarda múltiples registros de auxiliar en la base de datos
     * @param {KnexAuxiliariesRepository} repository - Repositorio para guardar los registros
     * @param {string} tableName - Nombre de la tabla donde se guardarán los registros
     * @param {number} count - Número de registros a crear
     * @param {object} baseData - Datos base para todos los registros
     * @returns {Promise<object[]>} Los registros guardados
     */
    static async createMultipleAuxiliaries(repository, tableName, count, baseData = {}) {
        const auxiliaries = this.generateMultiple(count, baseData);
        const savedAuxiliaries = [];

        for (const auxiliary of auxiliaries) {
            const saved = await repository.save(tableName, auxiliary);
            savedAuxiliaries.push(saved);
        }

        return savedAuxiliaries;
    }
}
