export class ConfigurationAggregate {
    /** @type {Object} is initialized in the constructor */
    #configurations;
    get configurations() {
        return this.#configurations;
    }

    /**
     * @param {string} type - The type of the configuration.
     * @param {Object} [data] - Initial data for the configuration.
     */
    constructor(type, data = {}) {
        this.type = type;
        this.#ensureValidDataStructure(data);
        // Materialize the 'agente'/'admin' branches on `data` BEFORE capturing
        // them so the aggregate and `data` share the same references: the
        // structural backfill in the subclass `ensureDataStructure()` runs after
        // `super()` and mutates `data`, and those defaults must be reflected in
        // `#configurations` (e.g. a stored row with no `admin` key).
        data.application.agente ??= {};
        data.application.admin ??= {};
        this.#configurations = {
            application: {
                agente: data.application.agente,
                admin: data.application.admin,
            },
        };
    }

    /**
     * Ensures the structure of the initial data is valid.
     * @param {Object} data - The data to validate.
     * @throws {Error} - If the data structure is invalid.
     */
    #ensureValidDataStructure(data) {
        if (!data.application || typeof data.application !== 'object') {
            throw new Error('Invalid data structure: data.application must contain both "agente" and "admin".');
        }
    }

    /**
     * Ensures the application and module names are valid.
     * @param {string} application - The application to ensure.
     * @param {string} module - The module to ensure.
     * @throws {Error} - If validation fails.
     */
    #ensureApplicationAndModule(application, module) {
        const validApplications = ['agente', 'admin'];
        if (!validApplications.includes(application)) {
            throw new Error(
                `Invalid application: ${application}. Valid applications are: ${validApplications.join(', ')}`
            );
        }
        if (typeof module !== 'string' || module.trim() === '') {
            throw new Error('Module name must be a non-empty string.');
        }
    }

    /**
     * Gets the configuration for a specific application and module.
     * @param {string} application - The application (e.g., 'agent', 'admin').
     * @param {string} module - The specific module name.
     * @returns {Object|null} - The configuration object or null if not found.
     */
    getConfig(application, module) {
        return this.#configurations.application[application]?.[module] ?? null;
    }

    /**
     * Sets the configuration for a specific application and module.
     * @param {string} application - The application (e.g., 'agent', 'admin').
     * @param {string} module - The specific module name.
     * @param {Object} data - The configuration data to set.
     */
    setConfig(application, module, data) {
        this.#ensureApplicationAndModule(application, module);
        this.#configurations.application[application] = {
            ...this.#configurations.application[application],
            [module]: data,
        };
    }

    /**
     * Deeply merges new configuration data into the existing configurations.
     * @param {Object} data - The partial configuration data to merge.
     */
    merge(data) {
        if (!data?.application || typeof data.application !== 'object') return;

        // Merge onto a copy and validate it in strict mode: the aggregate's
        // in-memory state is only replaced once validation passes, so a rejected
        // partial update never leaves an invalid value behind.
        const candidate = structuredClone(this.#configurations);
        for (const key of ['agente', 'admin']) {
            if (data.application[key]) {
                this.#deepMerge(candidate.application[key], data.application[key]);
            }
        }

        this.ensureDataStructure(candidate, { strict: true });
        this.#configurations = candidate;
    }

    /**
     * Validates the configuration structure. Subclasses must override this.
     */
    ensureDataStructure() {
        throw new Error('ensureDataStructure() must be implemented by subclass');
    }

    /**
     * Recursively merges source into target.
     * @param {Object} target
     * @param {Object} source
     * @private
     */
    #deepMerge(target, source) {
        for (const key of Object.keys(source)) {
            if (source[key] instanceof Object && key in target && !Array.isArray(source[key])) {
                this.#deepMerge(target[key], source[key]);
            } else {
                target[key] = source[key];
            }
        }
    }

    /**
     * Converts the configuration to a JSON object.
     * @returns {Object} - The configuration object.
     */
    toJson() {
        return this.#configurations;
    }
}
