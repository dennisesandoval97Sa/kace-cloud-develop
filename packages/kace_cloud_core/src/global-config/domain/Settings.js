import { Behaviors } from './settings/Behaviors';
import { Layouts } from './settings/Layouts';
import { CustomFields } from './settings/CustomFields';
import { Helper } from '../../shared';

export class Settings {
    /** @type {Layouts} is initialized in the constructor */
    #layouts;
    /** @type {Behaviors} is initialized in the constructor */
    #behaviors;
    /** @type {CustomFields} is initialized in the constructor */
    #customFields;

    /**
     * Creates an instance of Settings.
     * @param {Object} settings - The settings object containing layouts, behaviors, and custom fields.
     * @throws {Error} If the settings object is invalid or required properties are missing.
     */
    constructor(settings, { strict = true } = {}) {
        this.#ensureValidSettings(settings);
        // SONAR-EXC: Se deja el TODO ya que es deuda tecnica que se resolverá a futuro
        // TODO: Incorporar la estructura de datos para cada sección
        this.#layouts = new Layouts(settings.layouts ?? { application: {} }, { strict });
        this.#behaviors = new Behaviors(settings.behaviors ?? { application: {} }, { strict });
        this.#customFields = new CustomFields(settings.custom_fields ?? { application: {} });
    }

    /**
     * Validates the provided settings.
     * @param {Object} settings - The settings object to validate.
     * @throws {Error} If the settings are missing or required properties are absent.
     */
    #ensureValidSettings(settings) {
        if (!settings || Object.keys(settings).length === 0) {
            Helper.logError('Settings are required');
            throw new Error('Settings are required');
        }

        if (!settings.layouts) {
            Helper.logError('Layouts are required');
            throw new Error('Layouts are required');
        }

        if (!settings.behaviors) {
            Helper.logError('Behaviors are required');
            throw new Error('Behaviors are required');
        }

        if (!settings.custom_fields) {
            Helper.logError('Custom fields are required');
            throw new Error('Custom fields are required');
        }
    }

    set layouts(value) {
        this.#layouts = new Layouts(value);
    }

    get layouts() {
        return this.#layouts;
    }

    set behaviors(value) {
        this.#behaviors = new Behaviors(value);
    }

    get behaviors() {
        return this.#behaviors;
    }

    set customFields(value) {
        this.#customFields = new CustomFields(value);
    }

    get customFields() {
        return this.#customFields;
    }

    /**
     * Gets the settings value.
     * @returns {Object} The settings value including layouts, behaviors, and custom fields.
     */
    get value() {
        return {
            layouts: this.#layouts.toJson(),
            behaviors: this.#behaviors.toJson(),
            custom_fields: this.#customFields.toJson(),
        };
    }

    /**
     * Merges partial settings into the current settings.
     * @param {Object} partialSettings
     */
    merge(partialSettings) {
        if (!partialSettings || typeof partialSettings !== 'object') return;

        const sections = {
            layouts: this.#layouts,
            behaviors: this.#behaviors,
            custom_fields: this.#customFields,
        };

        for (const [key, section] of Object.entries(sections)) {
            if (partialSettings[key]) {
                section.merge(partialSettings[key]);
            }
        }
    }
}
