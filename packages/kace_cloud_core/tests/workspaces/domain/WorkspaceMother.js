import { v4 as uuidV4 } from 'uuid';
import { Workspaces } from '../../../src/workspaces/domain/Workspaces.js';

/**
 * Mother object para generar datos de prueba del dominio Workspaces.
 */
export default class WorkspaceMother {
    /**
     * DTO base (válido y totalmente controlado)
     * @param {Object} overrides - Campos a sobrescribir
     * @returns {Object} DTO válido para crear un Workspace
     */
    static dto(overrides = {}) {
        const workspace_id = overrides.id ?? uuidV4();
        return {
            id: workspace_id,
            description: overrides.description ?? 'Test Workspace',
            is_active: overrides.is_active ?? true,
            tag: overrides.tag ?? 'test-tag',
            rules: overrides.rules ?? null,
            mails_accounts: overrides.mails_accounts ?? [],
            channel_hub_accounts: overrides.channel_hub_accounts ?? [],
            groups: overrides.groups ?? [],
            tag_creation_flow_id: overrides.tag_creation_flow_id ?? null,
            tag_update_flow_id: overrides.tag_update_flow_id ?? null,
            tag_deletion_flow_id: overrides.tag_deletion_flow_id ?? null,
            created_by: overrides.created_by ?? uuidV4(),
            created_at: overrides.created_at ?? new Date().toISOString(),
            deleted_at: null,
            deleted_by: null,
        };
    }

    /**
     * Crea un workspace con valores aleatorios
     * @param {Object} overrides - Campos a sobrescribir
     * @returns {Object} DTO con valores aleatorios
     */
    static randomDto(overrides = {}) {
        const randomId = uuidV4();
        const randomSuffix = Math.random().toString(36).substring(7);
        return {
            id: overrides.id ?? randomId,
            description: overrides.description ?? `Workspace ${randomSuffix}`,
            is_active: overrides.is_active ?? Math.random() > 0.5,
            tag: overrides.tag ?? `tag-${randomSuffix}`,
            rules: overrides.rules ?? null,
            mails_accounts: overrides.mails_accounts ?? [],
            channel_hub_accounts: overrides.channel_hub_accounts ?? [],
            groups: overrides.groups ?? [],
            tag_creation_flow_id: overrides.tag_creation_flow_id ?? null,
            tag_update_flow_id: overrides.tag_update_flow_id ?? null,
            tag_deletion_flow_id: overrides.tag_deletion_flow_id ?? null,
            created_by: overrides.created_by ?? uuidV4(),
            created_at: overrides.created_at ?? new Date().toISOString(),
            deleted_at: null,
            deleted_by: null,
        };
    }

    /**
     * Crea una entidad Workspaces desde un DTO
     * @param {Object} overrides - Campos a sobrescribir
     * @returns {Workspaces} Entidad Workspaces
     */
    static entity(overrides = {}) {
        const dto = WorkspaceMother.dto(overrides);
        return Workspaces.create(dto);
    }

    /**
     * Crea un workspace completo en BD
     * @param {KnexWorkspacesRepository} repository - Repositorio de workspaces
     * @param {Object} overrides - Campos a sobrescribir
     * @returns {Promise<Workspaces>} DTO del workspace creado
     */
    static async createWorkspace(repository, overrides = {}) {
        const dto = WorkspaceMother.dto(overrides);
        const workspace = Workspaces.create(dto);
        await repository.save(workspace);
        return workspace;
    }

    /**
     * Crea múltiples workspaces en BD
     * @param {KnexWorkspacesRepository} repository - Repositorio de workspaces
     * @param {number} count - Cantidad de workspaces a crear
     * @param {Object} overrides - Campos a sobrescribir en todos
     * @returns {Promise<Object[]>} Array de DTOs creados
     */
    static async createMany(repository, count, overrides = {}) {
        const workspaces = [];
        for (let i = 0; i < count; i++) {
            const dto = await WorkspaceMother.createWorkspace(repository, {
                ...overrides,
                description: overrides.description ?? `Workspace ${i + 1}`,
            });
            workspaces.push(dto);
        }
        return workspaces;
    }

    /**
     * DTO para un workspace inactivo
     * @param {Object} overrides - Campos a sobrescribir
     * @returns {Object} DTO de workspace inactivo
     */
    static inactiveDto(overrides = {}) {
        return WorkspaceMother.dto({
            ...overrides,
            is_active: false,
        });
    }

    /**
     * DTO para un workspace con reglas
     * @param {Object} rules - Reglas del workspace
     * @param {Object} overrides - Campos a sobrescribir
     * @returns {Object} DTO de workspace con reglas
     */
    static withRulesDto(rules, overrides = {}) {
        return WorkspaceMother.dto({
            ...overrides,
            rules: rules ?? {
                max_emails_per_day: 100,
                allowed_domains: ['example.com'],
            },
        });
    }

    /**
     * DTO para un workspace con cuentas de correo asociadas
     * @param {string[]} mailAccountIds - IDs de cuentas de correo
     * @param {Object} overrides - Campos a sobrescribir
     * @returns {Object} DTO de workspace con cuentas de correo
     */
    static withMailAccountsDto(mailAccountIds, overrides = {}) {
        return WorkspaceMother.dto({
            ...overrides,
            mails_accounts: mailAccountIds,
        });
    }

    /**
     * DTO para un workspace eliminado (soft delete)
     * @param {Object} overrides - Campos a sobrescribir
     * @returns {Object} DTO de workspace eliminado
     */
    static deletedDto(overrides = {}) {
        return {
            ...WorkspaceMother.dto(overrides),
            deleted_at: new Date().toISOString(),
            deleted_by: overrides.deleted_by ?? uuidV4(),
        };
    }
}
