import { v4 as uuidv4 } from 'uuid';
import { Interaction } from '../../../src/interactions/domain/Interaction.js';
import Chance from 'chance';
import { globalUserId } from '@kace/database';
import { ensureParentRows } from '../../support/ensureParentRow.js';

/**
 * Mother object para generar datos de prueba del dominio Interaction.
 */
export default class InteractionMother {
    /**
     * Postgres exige que existan las filas padre de estas claves foraneas, y
     * esta factoria inventaba los ids con `uuidv4()` sin respaldarlos.
     *
     * Se garantizan SIEMPRE, tambien cuando el llamador fijo el id:
     * `ensureParentRow` es idempotente, asi que respaldar una fila que ya existe
     * no cuesta nada, mientras que saltarsela deja el insert al borde de una
     * violacion. Las columnas salen de pg_constraint, no de mirar el dto.
     *
     * @param {import('knex').Knex} connection
     * @param {Object} dto
     * @returns {Promise<void>}
     */
    static async ensureRelations(connection, dto) {
        await ensureParentRows(connection, [
            { table: 'workspaces', id: dto.workspace_id, extra: { is_active: true } },
            { table: 'emails', id: dto.email_id },
        ]);
    }

    /**
     * Generates a Data Transfer Object (DTO) for the `Interaction` entity.
     *
     * @param {Object} overrides - Values to override defaults
     * @returns {Object} The DTO containing the properties for an `Interaction` entity.
     */
    static dto(overrides = {}) {
        return {
            id: overrides.id ?? uuidv4(),
            channel_id: overrides.channel_id ?? 'email',
            client_identifier: overrides.client_identifier ?? uuidv4(),
            external_identifier: overrides.external_identifier ?? `ext-${uuidv4().substring(0, 8)}`,
            description: overrides.description ?? 'Test interaction description',
            priority: overrides.priority ?? 'normal',
            workspace_id: overrides.workspace_id ?? uuidv4(),
            email_id: overrides.email_id ?? null,
            start_review_at: overrides.start_review_at ?? null,
            start_review_by: overrides.start_review_by ?? null,
            conversation_id: overrides.conversation_id ?? uuidv4(),
            receipt_at: overrides.receipt_at ?? new Date().toISOString(),
            created_at: new Date(),
            created_by: globalUserId,
            closed_at: overrides.closed_at ?? null,
            closed_by: overrides.closed_by ?? null,
            is_closed: overrides.is_closed ?? false,
            in_review: overrides.in_review ?? false,
            is_migrated: overrides.is_migrated ?? false,
        };
    }

    /**
     * Creates an `Interaction` instance and saves it to the repository.
     *
     * @param {KnexInteractionRepository} repository - The repository to save the `Interaction` instance.
     * @param {Object} overrides - Values to override defaults
     * @returns {Promise<Interaction>} The created `Interaction` instance.
     */
    static async createInteraction(repository, overrides = {}) {
        const dto = InteractionMother.dto(overrides);
        await InteractionMother.ensureRelations(repository.connection, dto);
        const interaction = Interaction.create({
            ...dto,
            created_at: new Date(),
            created_by: globalUserId,
        });
        await repository.save(interaction);
        return interaction;
    }

    /**
     * Generates a random Data Transfer Object (DTO) for the `Interaction` entity.
     *
     * @returns {Object} The DTO containing random properties for an `Interaction` entity.
     */
    static randomDto() {
        const chance = new Chance();
        return {
            id: uuidv4(),
            channel_id: chance.pickone(['email', 'sms', 'chat', 'voice']),
            client_identifier: uuidv4(),
            external_identifier: `ext-${chance.string({ length: 8, alpha: true })}`,
            description: chance.sentence({ words: 5 }),
            priority: chance.pickone(['low', 'normal', 'high', 'urgent']),
            workspace_id: uuidv4(),
            start_review_at: null,
            start_review_by: null,
            conversation_id: uuidv4(),
            receipt_at: null,
            closed_at: null,
            closed_by: null,
            is_closed: false,
            in_review: false,
            is_migrated: false,
            created_at: new Date().toISOString(),
            created_by: uuidv4(),
            updated_at: null,
            updated_by: null,
            deleted_at: null,
            deleted_by: null,
        };
    }

    /**
     * Creates an `Interaction` instance with random properties and saves it to the repository.
     *
     * @param {KnexInteractionRepository} repository - The repository to save the `Interaction` instance.
     * @returns {Promise<Interaction>} The created `Interaction` instance.
     */
    static async createRandomInteraction(repository) {
        const dto = InteractionMother.randomDto();
        await InteractionMother.ensureRelations(repository.connection, dto);
        const interaction = Interaction.create(dto);
        await repository.save(interaction);
        return interaction;
    }

    /**
     * DTO for an interaction in review state.
     *
     * @param {Object} overrides - Values to override defaults
     * @returns {Object} DTO for an interaction in review
     */
    static inReviewDto(overrides = {}) {
        return InteractionMother.dto({
            ...overrides,
            in_review: true,
            start_review_at: new Date().toISOString(),
            start_review_by: overrides.start_review_by ?? uuidv4(),
        });
    }

    /**
     * Creates an interaction in review state and saves it to the repository.
     *
     * @param {KnexInteractionRepository} repository - The repository to save the `Interaction` instance.
     * @param {Object} overrides - Values to override defaults
     * @returns {Promise<Interaction>} The created `Interaction` instance.
     */
    static async createInReviewInteraction(repository, overrides = {}) {
        const dto = InteractionMother.inReviewDto(overrides);
        await InteractionMother.ensureRelations(repository.connection, dto);
        const interaction = Interaction.create(dto);
        await repository.save(interaction);
        return interaction;
    }

    /**
     * DTO for a closed interaction.
     *
     * @param {Object} overrides - Values to override defaults
     * @returns {Object} DTO for a closed interaction
     */
    static closedDto(overrides = {}) {
        return InteractionMother.dto({
            ...overrides,
            is_closed: true,
            closed_at: new Date().toISOString(),
            closed_by: overrides.closed_by ?? uuidv4(),
        });
    }

    /**
     * Creates a closed interaction and saves it to the repository.
     *
     * @param {KnexInteractionRepository} repository - The repository to save the `Interaction` instance.
     * @param {Object} overrides - Values to override defaults
     * @returns {Promise<Interaction>} The created `Interaction` instance.
     */
    static async createClosedInteraction(repository, overrides = {}) {
        const dto = InteractionMother.closedDto(overrides);
        await InteractionMother.ensureRelations(repository.connection, dto);
        const interaction = Interaction.create(dto);
        await repository.save(interaction);
        return interaction;
    }

    /**
     * DTO for an email channel interaction.
     *
     * @param {Object} overrides - Values to override defaults
     * @returns {Object} DTO for an email interaction
     */
    static emailDto(overrides = {}) {
        return InteractionMother.dto({
            ...overrides,
            channel_id: 'email',
            external_identifier: overrides.external_identifier ?? `sender-${uuidv4().substring(0, 8)}@example.com`,
        });
    }

    /**
     * DTO for an SMS channel interaction.
     *
     * @param {Object} overrides - Values to override defaults
     * @returns {Object} DTO for an SMS interaction
     */
    static smsDto(overrides = {}) {
        const chance = new Chance();
        return InteractionMother.dto({
            ...overrides,
            channel_id: 'sms',
            external_identifier: overrides.external_identifier ?? chance.phone({ formatted: false }),
        });
    }

    /**
     * DTO for a high priority interaction.
     *
     * @param {Object} overrides - Values to override defaults
     * @returns {Object} DTO for a high priority interaction
     */
    static highPriorityDto(overrides = {}) {
        return InteractionMother.dto({
            ...overrides,
            priority: 'high',
        });
    }

    /**
     * Creates multiple interactions in the repository.
     *
     * @param {KnexInteractionRepository} repository - The repository to save the interactions.
     * @param {number} count - Number of interactions to create
     * @param {Object} overrides - Values to override defaults for all interactions
     * @returns {Promise<Interaction[]>} Array of created interactions
     */
    static async createMany(repository, count, overrides = {}) {
        const interactions = [];
        for (let i = 0; i < count; i++) {
            const interaction = await InteractionMother.createInteraction(repository, {
                ...overrides,
                description: overrides.description ?? `Interaction ${i + 1}`,
            });
            interactions.push(interaction);
        }
        return interactions;
    }
}
