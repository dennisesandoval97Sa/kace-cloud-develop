import axios from "axios";
import { getDomainFromUrl } from "../services/urlValidator";
import { URL_AND_KEYS } from "../utils/urlAndKeys";
import { genericSearchService } from "./genericSearchService";
import { COGNITO_URL } from "../utils/URL";

const SSL_VALIDATION_EXEMPT_DOMAINS = [
    COGNITO_URL,
];

/**
 * Clase para manejar las conexiones HTTP/HTTPS con validación de certificados y conexiones permitidas
 */
class AxiosHttpClient {
    constructor () {
        this.axiosInstance = axios.create();
        this.allowedConnectionsCache = new Map();
        this.setupInterceptors();
    }

    /**
     * Verifica si un dominio está exento de validación SSL.
     * @param {string} domain - Dominio a verificar.
     * @returns {boolean} True si está exento.
     */
    isDomainExemptFromSSLValidation (domain) {
        return SSL_VALIDATION_EXEMPT_DOMAINS.some(exemptDomain =>
            exemptDomain.includes(domain),
        );
    }

    /**
     * Obtiene los datos de una conexión permitida
     * @param {string} domain - URL a validar
     * @returns {Promise<Object|null>} Datos de la conexión permitida o null si no está permitida
     */
    async getAllowedConnection (domain) {
        if (!domain) {
            throw new Error(`Invalid URL: ${domain}`);
        }

        if (this.allowedConnectionsCache.has(domain)) {
            return this.allowedConnectionsCache.get(domain);
        }

        try {
            const filter = [
                {
                    field: "is_active",
                    operator: "eq",
                    value: 1,
                    type: "AND",
                },
                {
                    field: "connection",
                    operator: "eq",
                    value: domain,
                    type: "AND",
                },
            ];

            const response = await genericSearchService(
                `${URL_AND_KEYS.allowedConnections.url}/search`,
                filter,
            );

            const allowedConnection = response?.data?.[0] || null;

            this.allowedConnectionsCache.set(domain, allowedConnection);

            return allowedConnection;
        } catch (error) {
            throw new Error(`Failed to validate connection for ${domain}: ${error.message}`);
        }
    }

    /**
     * Configura los interceptores de axios
     */
    setupInterceptors () {
        this.axiosInstance.interceptors.request.use(
            async (config) => {
                try {
                    const domain = getDomainFromUrl(config.url);

                    if (!domain) {
                        throw new Error(`Invalid URL: ${config.url}`);
                    }

                    if (this.isDomainExemptFromSSLValidation(domain)) {
                        config.metadata = { domain, isExemptFromSSL: true };
                        return config;
                    }

                    const allowedConnection = await this.getAllowedConnection(config.url);
                    if (!allowedConnection) {
                        throw new Error(`Connection not allowed for URL: ${config.url}`);
                    }

                    config.metadata = {
                        allowedConnection,
                        domain,
                    };

                    return config;
                } catch (error) {
                    return Promise.reject(error);
                }
            },
            (error) => {
                return Promise.reject(error);
            },
        );

        this.axiosInstance.interceptors.response.use(
            (response) => {
                response.validationInfo = {
                    domain: response.config.metadata?.domain,
                    isSecure: response.config.url.startsWith("https://"),
                    hasSSL: response.config.metadata?.allowedConnection?.has_ssl,
                };
                return response;
            },
            (error) => {
                if (error.message.includes("Certificate fingerprint mismatch")) {
                    error.isSecurityError = true;
                }
                return Promise.reject(error);
            },
        );
    }

    /**
     * Realiza una petición GET
     * @param {string} url - URL de la petición
     * @param {Object} config - Configuración adicional de axios
     * @returns {Promise} Promesa con la respuesta
     */
    async get (url, config = {}) {
        return this.axiosInstance.get(url, config);
    }

    /**
     * Realiza una petición POST
     * @param {string} url - URL de la petición
     * @param {any} data - Datos a enviar
     * @param {Object} config - Configuración adicional de axios
     * @returns {Promise} Promesa con la respuesta
     */
    async post (url, data, config = {}) {
        return this.axiosInstance.post(url, data, config);
    }

    /**
     * Realiza una petición PUT
     * @param {string} url - URL de la petición
     * @param {any} data - Datos a enviar
     * @param {Object} config - Configuración adicional de axios
     * @returns {Promise} Promesa con la respuesta
     */
    async put (url, data, config = {}) {
        return this.axiosInstance.put(url, data, config);
    }

    /**
     * Realiza una petición DELETE
     * @param {string} url - URL de la petición
     * @param {Object} config - Configuración adicional de axios
     * @returns {Promise} Promesa con la respuesta
     */
    async delete (url, config = {}) {
        return this.axiosInstance.delete(url, config);
    }

    /**
     * Realiza una petición PATCH
     * @param {string} url - URL de la petición
     * @param {any} data - Datos a enviar
     * @param {Object} config - Configuración adicional de axios
     * @returns {Promise} Promesa con la respuesta
     */
    async patch (url, data, config = {}) {
        return this.axiosInstance.patch(url, data, config);
    }

    /**
     * Realiza una petición con método personalizado
     * @param {Object} config - Configuración completa de axios
     * @returns {Promise} Promesa con la respuesta
     */
    async request (config) {
        return this.axiosInstance.request(config);
    }

    /**
     * Limpia el cache de conexiones permitidas
     */
    clearCache () {
        this.allowedConnectionsCache.clear();
    }

    /**
     * Obtiene la instancia de axios configurada
     * @returns {axios.AxiosInstance} Instancia de axios
     */
    getAxiosInstance () {
        return this.axiosInstance;
    }
}

const axiosHttpClient = new AxiosHttpClient();

export default axiosHttpClient;
export { AxiosHttpClient };
