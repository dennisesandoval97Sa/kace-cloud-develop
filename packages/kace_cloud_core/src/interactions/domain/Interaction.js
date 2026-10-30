import {
    AggregateRoot,
    ValueObjectBoolean,
    ValueObjectString,
    ValueObjectTimestamp,
    ValueObjectUuid,
} from '../../shared/index.js';
import { ValueObjectDescription } from './ValueObjectDescription.js';

const LEGACY_PERSISTENCE_RECONSTITUTION = Symbol('legacy-persistence-reconstitution');

export class Interaction extends AggregateRoot {
    /**
     * Interaction Aggregate
     *
     * Represents a customer interaction coming from different channels
     * such as email, SMS, or chat.
     *
     * ### Identifiers
     * - `external_identifier`:
     *   External origin of the interaction.
     *   Examples:
     *   - Telephone number (SMS / voice)
     *   - Sender address (email)
     *
     * - `client_identifier`:
     *   Identifier of the client within the channel.
     *   Examples:
     *   - Email message ID
     *   - SMS ID
     *   - Chat conversation ID
     *
     * ### Content
     * - `description`:
     *   Main content of the interaction.
     *   Examples:
     *   - Email subject
     *   - SMS or chat message body
     *
     * ### State
     * The interaction state is represented by boolean flags:
     *
     * - `in_review`:
     *   Indicates whether the interaction is currently under review.
     *
     * - `is_closed`:
     *   Indicates whether the interaction has been closed.
     *
     * Logical states:
     * - Created: `in_review = false` and `is_closed = false`
     * - In review: `in_review = true`
     * - Closed: `is_closed = true`
     */

    /** @type {ValueObjectString} is initialized in the constructor */
    #channel_id;
    /** @type {ValueObjectString} is initialized in the constructor */
    #client_identifier;
    /** @type {ValueObjectString} is initialized in the constructor */
    #external_identifier;
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #description;
    /** @type {ValueObjectString} is initialized in the constructor */
    #priority;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #start_review_at;
    /** @type {ValueObjectString} is initialized in the constructor */
    #start_review_by;
    /** @type {ValueObjectString} is initialized in the constructor */
    #conversation_id;
    /** @type {ValueObjectString} is initialized in the constructor */
    #workspace_id;
    /** @type {ValueObjectUuid} is initialized in the constructor */
    #email_id;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #receipt_at;
    /** @type {ValueObjectTimestamp} is initialized in the constructor */
    #closed_at;
    /** @type {ValueObjectString} is initialized in the constructor */
    #closed_by;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_closed;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #in_review;
    /** @type {ValueObjectBoolean} is initialized in the constructor */
    #is_migrated;
    /** @type {ValueObjectString} is initialized in the constructor */
    #closed_observation;
    /** @type {ValueObjectString} is initialized in the constructor */
    #delete_observation;

    constructor(dto, reconstitutionToken = null) {
        super(dto.id);
        this.#channel_id = new ValueObjectString('channel_id', dto.channel_id);
        this.#client_identifier = new ValueObjectString('client_identifier', dto.client_identifier);
        this.#external_identifier = new ValueObjectString('external_identifier', dto.external_identifier);
        this.#description = new ValueObjectDescription('description', dto.description, true);
        this.#priority = new ValueObjectString('priority', dto.priority);
        this.#workspace_id = new ValueObjectString(
            'workspace_id',
            dto.workspace_id,
            reconstitutionToken === LEGACY_PERSISTENCE_RECONSTITUTION && dto.workspace_id === null
        );
        this.#email_id = new ValueObjectUuid('email_id', dto.email_id, true);
        this.#start_review_at = new ValueObjectTimestamp('start_review_at', dto.start_review_at, true);
        this.#start_review_by = new ValueObjectString('start_review_by', dto.start_review_by, true);
        this.#conversation_id = new ValueObjectString('conversation_id', dto.conversation_id);
        this.#receipt_at = new ValueObjectTimestamp('receipt_at', dto.receipt_at, true);
        this.#closed_at = new ValueObjectTimestamp('closed_at', dto.closed_at, true);
        this.#closed_by = new ValueObjectString('closed_by', dto.closed_by, true);
        this.#is_closed = new ValueObjectBoolean('is_closed', dto.is_closed, true);
        this.#in_review = new ValueObjectBoolean('in_review', dto.in_review, true);
        this.#is_migrated = new ValueObjectBoolean('is_migrated', dto.is_migrated ?? false);
        this.#closed_observation = new ValueObjectString('closed_observation', dto.closed_observation, true);
        this.#delete_observation = new ValueObjectString('delete_observation', dto.delete_observation, true);
        this.created_by = dto.created_by;
        this.created_at = dto.created_at;
        this.updated_by = dto.updated_by;
        this.updated_at = dto.updated_at;
        this.deleted_by = dto.deleted_by;
        this.deleted_at = dto.deleted_at;
    }

    static create(dto) {
        const interaction = new Interaction(dto);
        return interaction;
    }

    /**
     * Rebuilds an Interaction from persisted state. The database still permits
     * legacy rows without a workspace, while new domain writes keep requiring one.
     *
     * @param {object} dto persisted interaction row
     * @returns {Interaction}
     */
    static reconstitute(dto) {
        return new Interaction(dto, LEGACY_PERSISTENCE_RECONSTITUTION);
    }

    get channel_id() {
        return this.#channel_id;
    }

    get client_identifier() {
        return this.#client_identifier;
    }

    get external_identifier() {
        return this.#external_identifier;
    }

    get description() {
        return this.#description;
    }

    get priority() {
        return this.#priority;
    }

    get is_closed() {
        return this.#is_closed;
    }

    get in_review() {
        return this.#in_review;
    }

    get is_migrated() {
        return this.#is_migrated;
    }

    get start_review_at() {
        return this.#start_review_at;
    }

    get start_review_by() {
        return this.#start_review_by;
    }

    get conversation_id() {
        return this.#conversation_id;
    }

    get workspace_id() {
        return this.#workspace_id;
    }

    get email_id() {
        return this.#email_id;
    }

    get receipt_at() {
        return this.#receipt_at;
    }

    get closed_at() {
        return this.#closed_at;
    }

    get closed_by() {
        return this.#closed_by;
    }

    get closed_observation() {
        return this.#closed_observation;
    }

    get delete_observation() {
        return this.#delete_observation;
    }

    set channel_id(value) {
        this.#channel_id = new ValueObjectString('channel_id', value);
        this.changedAttributes.channel_id = this.#channel_id.value;
    }

    set client_identifier(value) {
        this.#client_identifier = new ValueObjectString('client_identifier', value);
        this.changedAttributes.client_identifier = this.#client_identifier.value;
    }

    set external_identifier(value) {
        this.#external_identifier = new ValueObjectString('external_identifier', value);
        this.changedAttributes.external_identifier = this.#external_identifier.value;
    }

    set description(value) {
        this.#description = new ValueObjectDescription('description', value);
        this.changedAttributes.description = this.#description.value;
    }

    set priority(value) {
        this.#priority = new ValueObjectString('priority', value);
        this.changedAttributes.priority = this.#priority.value;
    }

    set in_review(value) {
        this.#in_review = new ValueObjectBoolean('in_review', value);
        this.changedAttributes.in_review = this.#in_review.value;
    }

    set is_closed(value) {
        this.#is_closed = new ValueObjectBoolean('is_closed', value);
        this.changedAttributes.is_closed = this.#is_closed.value;
    }

    set is_migrated(value) {
        this.#is_migrated = new ValueObjectBoolean('is_migrated', value);
        this.changedAttributes.is_migrated = this.#is_migrated.value;
    }

    set start_review_at(value) {
        this.#start_review_at = new ValueObjectTimestamp('start_review_at', value);
        this.changedAttributes.start_review_at = this.#start_review_at.value;
    }

    set start_review_by(value) {
        this.#start_review_by = new ValueObjectString('start_review_by', value);
        this.changedAttributes.start_review_by = this.#start_review_by.value;
    }

    set receipt_at(value) {
        this.#receipt_at = new ValueObjectTimestamp('receipt_at', value);
        this.changedAttributes.receipt_at = this.#receipt_at.value;
    }

    set conversation_id(value) {
        this.#conversation_id = new ValueObjectString('conversation_id', value);
        this.changedAttributes.conversation_id = this.#conversation_id.value;
    }

    set workspace_id(value) {
        this.#workspace_id = new ValueObjectString('workspace_id', value);
        this.changedAttributes.workspace_id = this.#workspace_id.value;
    }

    set email_id(value) {
        this.#email_id = new ValueObjectUuid('email_id', value, true);
        this.changedAttributes.email_id = this.#email_id.value;
    }

    set closed_at(value) {
        this.#closed_at = new ValueObjectTimestamp('closed_at', value);
        this.changedAttributes.closed_at = this.#closed_at.value;
    }

    set closed_by(value) {
        this.#closed_by = new ValueObjectString('closed_by', value);
        this.changedAttributes.closed_by = this.#closed_by.value;
    }

    set closed_observation(value) {
        this.#closed_observation = new ValueObjectString('closed_observation', value, true);
        this.changedAttributes.closed_observation = this.#closed_observation.value;
    }

    set delete_observation(value) {
        this.#delete_observation = new ValueObjectString('delete_observation', value, true);
        this.changedAttributes.delete_observation = this.#delete_observation.value;
    }
}
