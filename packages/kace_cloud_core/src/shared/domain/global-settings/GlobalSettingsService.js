import { GlobalConfigFinder } from '../../../global-config/domain/GlobalConfigFinder.js';
import { DomainError } from '../../errors/DomainError.js';

export class GlobalSettingsService {
    /** @type {GlobalConfigFinder} is initialized in the constructor */
    #configSettingsFinder;

    /** @type {Object} is initialized in the constructor */
    #settings;

    /**
     * Crea una instancia de GlobalSettingsService.
     * @param {GlobalConfigFinder} configSettingsFinder - configSettingsFinder para acceder a configuraciones globales.
     */
    constructor(configSettingsFinder) {
        if (!configSettingsFinder) {
            throw new DomainError('Invalid instance: must be an instance of GlobalConfigFinder');
        }
        this.#configSettingsFinder = configSettingsFinder;
        this.#settings = null;
    }

    /**
     * Carga las configuraciones globales desde la base de datos.
     * @param {string} id - El ID de la configuración global.
     * @throws {DomainError} Si no se encuentra la configuración o el JSON es inválido.
     */
    async loadSettings(id) {
        const globalConfig = await this.#configSettingsFinder.execute(id);
        if (!globalConfig || !globalConfig.settings) {
            throw new DomainError(`Configuration with ID ${id} not found or settings are missing`);
        }

        try {
            this.#settings =
                typeof globalConfig.settings === 'string' ? JSON.parse(globalConfig.settings) : globalConfig.settings;
        } catch {
            // SI: error al parsear JSON se manda error de dominio para ser manejado por el consumidor.
            throw new DomainError('Invalid JSON format in settings');
        }
    }

    /**
     * Obtiene un valor específico del JSON usando una ruta separada por puntos.
     * @param {string} path - La ruta separada por puntos (e.g., "application.agente.setting1").
     * @returns {any} El valor en la ruta especificada, o null si no se encuentra.
     * @throws {DomainError} Si las configuraciones no han sido cargadas o la ruta es inválida.
     */
    getValueByPath(path) {
        if (!this.#settings) {
            throw new DomainError('Settings have not been loaded. Call loadSettings() first.');
        }

        if (typeof path !== 'string') {
            throw new DomainError('Invalid path: must be a string');
        }

        return path
            .split('.')
            .reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : null), this.#settings.value);
    }

    /**
     * Obtiene todas las configuraciones cargadas.
     * @returns {Object} El JSON completo de configuraciones.
     * @throws {DomainError} Si las configuraciones no han sido cargadas.
     */
    get settings() {
        if (!this.#settings) {
            throw new DomainError('Settings have not been loaded. Call loadSettings() first.');
        }
        return this.#settings;
    }
}
