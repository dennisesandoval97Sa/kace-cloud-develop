import axios from 'axios';
import https from 'https';
import crypto from 'crypto';
import { InfrastructureError } from '../../errors/InfrastructureError.js';
import { Helper } from '../utils/Helper.js';
import { DomainAllowedConnectionFinder } from '../../../allowed-conections/index.js';

export class AxiosHttpClient {
    /**
     * @type {DomainAllowedConnectionFinder}
     */
    #allowedConnectionFinder;

    /**
     * @param {KnexAllowedConnectionsRepository} allowedConnectionRepository
     */
    constructor(allowedConnectionRepository) {
        this.#allowedConnectionFinder = new DomainAllowedConnectionFinder(allowedConnectionRepository);
    }

    /**
     * Verifica la seguridad de la conexión
     * @param {string} url - URL de la petición
     * @returns {Promise<{AllowedConnection}>}
     * @throws {InfrastructureError} Lanza un error si la conexión no está permitida o si la verificación falla.
     * @private
     */
    async #verifyConnectionSecurity(url) {
        try {
            const connectionToValidate = this.#getConnectionForValidation(url);
            const allowedConnection = await this.#allowedConnectionFinder.executeByConnection(connectionToValidate);

            if (!allowedConnection) {
                const message = `Connection to domain ${url} is not allowed`;
                Helper.logError(message);
                throw new InfrastructureError(message);
            }

            return allowedConnection;
        } catch (error) {
            Helper.logError(`Connection security verification failed: ${url}`, error);
            throw new InfrastructureError(error.message || 'Failed to verify connection security', { cause: error });
        }
    }

    /**
     * Builds a safe connection string for security validation by removing query/hash fragments.
     * This prevents false positives from query values such as "true" or "false".
     *
     * @param {string} url
     * @returns {string}
     * @private
     */
    #getConnectionForValidation(url) {
        if (typeof url !== 'string') {
            return url;
        }

        try {
            const parsed = new URL(url);
            return `${parsed.protocol}//${parsed.host}${parsed.pathname}`;
        } catch {
            return url.split('?')[0].split('#')[0];
        }
    }

    /**
     * Crea el agente HTTPS con la configuración de seguridad apropiada
     * @param {AllowedConnection} allowedConnection - Información de la conexión permitida
     * @returns {https.Agent}
     * @private
     */
    #createSecureHttpsAgent(allowedConnection) {
        const fingerPrint = allowedConnection.certificate.value;

        if (allowedConnection.has_ssl.value) {
            return new https.Agent({
                rejectUnauthorized: true,
                checkServerIdentity: (_host, cert) => {
                    if (!cert || !cert.raw) {
                        throw new Error(`Missing or invalid certificate (expected SHA256 fingerprint: ${fingerPrint})`);
                    }
                    const serverFingerprint = crypto.createHash('sha256').update(cert.raw).digest('hex');

                    if (serverFingerprint !== fingerPrint) {
                        return new Error(
                            `Certificate fingerprint mismatch. Expected: ${fingerPrint}, Received: ${serverFingerprint}`
                        );
                    }
                    return undefined;
                },
            });
        }

        return new https.Agent({ rejectUnauthorized: true });
    }

    /**
     * Detect common TLS certificate validation failures returned by Node/Axios.
     * @param {Error & {code?: string}} error
     * @returns {boolean}
     * @private
     */
    #isTlsCertificateValidationError(error) {
        const tlsErrorCodes = new Set([
            'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
            'UNABLE_TO_GET_ISSUER_CERT',
            'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
            'DEPTH_ZERO_SELF_SIGNED_CERT',
            'SELF_SIGNED_CERT_IN_CHAIN',
            'CERT_HAS_EXPIRED',
            'ERR_TLS_CERT_ALTNAME_INVALID',
        ]);

        if (tlsErrorCodes.has(error?.code)) {
            return true;
        }

        const message = String(error?.message || '').toLowerCase();
        return (
            message.includes('unable to verify the first certificate') ||
            message.includes('self signed certificate') ||
            message.includes('unable to get issuer certificate') ||
            message.includes('certificate has expired') ||
            message.includes('hostname/ip does not match certificate')
        );
    }

    /**
     * Maps an axios response to the HTTP client response shape.
     * @param {import('axios').AxiosResponse} response
     * @returns {{status:number, data:any, headers:any}}
     * @private
     */
    #mapResponse(response) {
        return {
            status: response.status,
            data: response.data,
            headers: response.headers,
        };
    }

    /**
     * Determines whether an insecure TLS retry should be attempted.
     * @param {Error & {request?: any}} error
     * @param {AllowedConnection} allowedConnection
     * @returns {boolean}
     * @private
     */
    #shouldRetryWithInsecureTls(error, allowedConnection) {
        return error?.request && this.#isTlsCertificateValidationError(error) && !allowedConnection?.has_ssl?.value;
    }

    /**
     * Builds axios config for insecure TLS retry.
     * @param {Object} axiosConfig
     * @returns {Object}
     * @private
     */
    #buildInsecureTlsRetryConfig(axiosConfig) {
        return {
            ...axiosConfig,
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
        };
    }

    /**
     * Executes axios request and retries once with insecure TLS when certificate validation fails
     * and the allowed connection does not enforce SSL pinning.
     *
     * @param {Object} axiosConfig
     * @param {AllowedConnection} allowedConnection
     * @returns {Promise<import('axios').AxiosResponse>}
     * @private
     */
    async #executeRequestWithTlsFallback(axiosConfig, allowedConnection) {
        try {
            return await axios.request(axiosConfig);
        } catch (firstAttemptError) {
            if (!this.#shouldRetryWithInsecureTls(firstAttemptError, allowedConnection)) {
                throw firstAttemptError;
            }

            Helper.logInfo('Retrying request with insecure TLS for non-pinned allowed connection', {
                url: axiosConfig.url,
                error: firstAttemptError.message,
                code: firstAttemptError.code,
            });

            try {
                return await axios.request(this.#buildInsecureTlsRetryConfig(axiosConfig));
            } catch (retryError) {
                retryError.firstAttemptError = firstAttemptError;
                retryError.retryWithInsecureTls = true;
                throw retryError;
            }
        }
    }

    /**
     * Realiza una petición HTTP
     * @param {Object} options - Opciones de la petición
     * @param {string} options.method - Método HTTP (GET, POST, etc.)
     * @param {string} options.url - URL de la petición
     * @param {Object} [options.headers={}] - Cabeceras de la petición
     * @param {Object} [options.data=null] - Cuerpo de la petición
     * @param {number} [options.timeout=300000] - Timeout en milisegundos
     * @returns {Promise<Object>} - Respuesta de la petición
     */
    async request(options) {
        try {
            const { method, url, headers = {}, timeout = 300000 } = options;
            const data = options.data;

            const allowedConnection = await this.#verifyConnectionSecurity(url);

            const httpsAgent = this.#createSecureHttpsAgent(allowedConnection);

            Helper.logDebug(
                'preparing request with options:',
                JSON.stringify({ method, url, headers, data, timeout, httpsAgent })
            );

            const axiosConfig = {
                method,
                url,
                headers,
                timeout,
                httpsAgent,
            };

            if (data !== undefined) {
                axiosConfig.data = data;
            }

            const response = await this.#executeRequestWithTlsFallback(axiosConfig, allowedConnection);

            return this.#mapResponse(response);
        } catch (error) {
            if (error.response) {
                Helper.logError(error);
                return this.#mapResponse(error.response);
            }
            if (error.request) {
                Helper.logError('No response received', error);
                if (
                    error.message?.includes('Missing or invalid certificate') ||
                    error.message?.includes('Certificate fingerprint mismatch.')
                ) {
                    throw new InfrastructureError(error.message, {
                        cause: error,
                    });
                }

                if (this.#isTlsCertificateValidationError(error)) {
                    throw new InfrastructureError(`TLS certificate validation failed: ${error.message}`, {
                        cause: error,
                    });
                }

                throw new InfrastructureError('Server did not respond', { cause: error });
            }

            Helper.logError('Request configuration error', error);
            throw new InfrastructureError(`Request failed: ${error.message}`, { cause: error });
        }
    }
}
