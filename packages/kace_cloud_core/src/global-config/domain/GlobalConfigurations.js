import { AggregateRoot, ValueObjectBoolean, ValueObjectDescription, ValueObjectStatus } from '../../shared';
import { Settings } from './Settings';

export class GlobalConfigurations extends AggregateRoot {
    /** @type {Settings} is initialized in the constructor */
    #settings;
    /** @type {ValueObjectStatus} is initialized in the constructor */
    #is_active;
    /** @type {ValueObjectDescription} is initialized in the constructor */
    #description;

    constructor(dto, { strict = true } = {}) {
        super(dto.id);
        this.#settings = new Settings(dto.settings, { strict });
        this.#is_active = new ValueObjectBoolean('is_active', Boolean(dto.is_active));
        this.#description = new ValueObjectDescription('description', dto.description ?? 'default');
        this.created_at = dto.created_at;
        this.updated_at = dto.updated_at;
        this.deleted_at = dto.deleted_at;
        this.created_by = dto.created_by;
        this.updated_by = dto.updated_by;
        this.deleted_by = dto.deleted_by;
    }

    get description() {
        return this.#description;
    }

    set description(value) {
        this.#description = new ValueObjectDescription('description', value);
        this.changedAttributes.description = this.#description.value;
    }

    get settings() {
        return this.#settings;
    }

    set settings(settings) {
        this.#settings = new Settings(settings);
        this.changedAttributes.settings = JSON.stringify(this.#settings.value);
    }

    get is_active() {
        return this.#is_active;
    }

    set is_active(is_active) {
        this.#is_active = new ValueObjectStatus('is_active', is_active);
        this.changedAttributes.is_active = this.#is_active.value;
    }

    /**
     * Updates the object with the provided data transfer object (DTO).
     * If settings are provided, they are merged with the current ones.
     * @param {Object} dto
     */
    update(dto) {
        const { settings, ...otherDto } = dto;

        if (settings) {
            const before = JSON.stringify(this.#settings.value);
            this.#settings.merge(settings);
            const after = JSON.stringify(this.#settings.value);

            if (before !== after) {
                this.changedAttributes.settings = after;
            }
        }

        super.update(otherDto);
    }

    static create(dto) {
        return new GlobalConfigurations(dto);
    }
}
