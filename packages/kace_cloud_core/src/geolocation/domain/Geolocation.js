import { AggregateRoot, InvalidArgumentError } from '../../shared/index.js';
import {
    ValueObjectActionType,
    ValueObjectIp4Address,
    ValueObjectLatitud,
    ValueObjectLongitud,
    ValueObjectMetadata,
    ValueObjectUser,
} from './value-objects/index.js';
import Creator from '../../shared/domain/aggregates/Creator.js';

export class Geolocation extends AggregateRoot {
    /**
     * @type {ValueObjectUser} is initialized in the constructor
     */
    #user_id;

    /**
     * @type {ValueObjectActionType} is initialized in the constructor
     */
    #action_type;

    /**
     * @type {ValueObjectLatitud} is initialized in the constructor
     */
    #latitud;

    /**
     * @type {ValueObjectLongitud} is initialized in the constructor
     */
    #longitud;

    /**
     * @type {ValueObjectIp4Address} is initialized in the constructor
     */
    #ip4_address;

    /**
     * @type {ValueObjectMetadata} is initialized in the constructor
     */
    #metadata;
    /** @type {Creator || null} is initialized in the constructor */
    #creator;

    /**
     * @param {Object}  dto
     * @param {string}  dto.id
     * @param {string}  dto.user_id
     * @param {string}  dto.action_type
     * @param {number}  dto.latitud
     * @param {number}  dto.longitud
     * @param {string}  dto.ip4_address
     * @param {Object}  dto.metadata
     * @param {Date}    dto.created_at
     * @param {Date}    dto.updated_at
     * @param {Date}    dto.deleted_at
     * @param {string}  dto.created_by
     * @param {string}  dto.updated_by
     * @param {string}  dto.deleted_by
     */
    constructor(dto, creator = null) {
        super(dto.id);
        this.#user_id = new ValueObjectUser('user_id', dto.user_id);
        this.#action_type = new ValueObjectActionType('action_type', dto.action_type ?? 'default');
        this.#latitud = new ValueObjectLatitud('latitud', dto.latitud ?? 'default');
        this.#longitud = new ValueObjectLongitud('longitud', dto.longitud ?? 'default');
        this.#ip4_address = new ValueObjectIp4Address('ip4_address', dto.ip4_address ?? 'default');
        this.#metadata = new ValueObjectMetadata('metadata', dto.metadata ?? {});
        this.#creator = creator;
        this.#ensureCreatorIsValid(creator);
        this.created_at = dto.created_at;
        this.updated_at = dto.updated_at;
        this.created_by = dto.created_by;
        this.updated_by = dto.updated_by;
        this.deleted_by = dto.deleted_by;
        this.deleted_at = dto.deleted_at;
    }
    #ensureCreatorIsValid(creator) {
        if (creator === null || creator instanceof Creator) {
            return;
        }
        throw new InvalidArgumentError('Comment: The creator must be an instance of Creator');
    }
    /**
     * Creates a new Geolocation instance from a DTO.
     * @param {Object} dto
     * @returns {Geolocation}
     */
    static create(dto) {
        return new Geolocation(dto);
    }

    set action_type(value) {
        if (!this.#areEqual(this.#action_type.value, value)) {
            this.#action_type = new ValueObjectActionType('action_type', value);
            this.changedAttributes.action_type = this.#action_type.value;
        }
    }

    set latitud(value) {
        if (!this.#areEqual(this.#latitud.value, value)) {
            this.#latitud = new ValueObjectLatitud('latitud', value);
            this.changedAttributes.latitud = this.#latitud.value;
        }
    }

    set longitud(value) {
        if (!this.#areEqual(this.#longitud.value, value)) {
            this.#longitud = new ValueObjectLongitud('longitud', value);
            this.changedAttributes.longitud = this.#longitud.value;
        }
    }

    set ip4_address(value) {
        if (!this.#areEqual(this.#ip4_address.value, value)) {
            this.#ip4_address = new ValueObjectIp4Address('ip4_address', value);
            this.changedAttributes.ip4_address = this.#ip4_address.value;
        }
    }

    set metadata(value) {
        if (!this.#areEqual(this.#metadata.value, value)) {
            this.#metadata = new ValueObjectMetadata('metadata', value);
            this.changedAttributes.metadata = this.#metadata.value;
        }
    }

    set creator(value) {
        this.#ensureCreatorIsValid(value);
        this.#creator = value;
    }

    /**
     * @returns {ValueObjectUser}
     */
    get user_id() {
        return this.#user_id;
    }

    /**
     * @returns {ValueObjectActionType}
     */
    get action_type() {
        return this.#action_type;
    }

    /**
     * @returns {ValueObjectLatitud}
     */
    get latitud() {
        return this.#latitud;
    }

    /**
     * @returns {ValueObjectLongitud}
     */
    get longitud() {
        return this.#longitud;
    }

    /**
     * @returns {ValueObjectIp4Address}
     */
    get ip4_address() {
        return this.#ip4_address;
    }

    /**
     * @returns {ValueObjectMetadata}
     */
    get metadata() {
        return this.#metadata;
    }

    get creator() {
        return this.#creator;
    }

    /**
     * @returns {boolean}
     */
    #areEqual(value, otherValue) {
        return value === otherValue;
    }
}
