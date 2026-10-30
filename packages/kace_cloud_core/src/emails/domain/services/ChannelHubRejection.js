import { CustomError } from '../../../shared/errors/CustomError.js';

/**
 * Traduce un rechazo de Channel Hub a un CustomError con código público.
 *
 * Channel Hub responde sus errores como problem+json (RFC 7807):
 *
 *   { "type": "urn:problem:bad-request", "title": "Bad Request",
 *     "detail": "Operator account is not healthy: ...", "status": 400,
 *     "instance": "/tst/v1/channel/email" }
 *
 * `AxiosHttpClient.request()` no lanza ante un error HTTP: mapea `error.response` y la
 * devuelve, así que ese cuerpo llega al contexto del flujo como una respuesta más y hay
 * que reconocerlo aquí.
 *
 * La detección es estructural (`status` + `detail`), no por texto. Channel Hub deriva su
 * `type` del status HTTP (`urn:problem:bad-request`, `urn:problem:not-found`…), así que no
 * identifica el problema concreto y no hay ningún código estable que mapear: comparar
 * contra literales como 'Operator account is not healthy' ataría KACE a la redacción exacta
 * de otro servicio y se rompería en silencio si la cambian. Por eso se propaga el `detail`
 * tal cual en vez de traducirlo.
 */

/**
 * Tope de lo que se republica al cliente. El `detail` es texto libre de un tercero: se
 * expone porque es lo único accionable para el agente, pero acotado para que un mensaje
 * largo del proveedor no arrastre trazas ni infle la respuesta.
 */
export const MAX_PUBLIC_DETAIL_LENGTH = 200;

/**
 * Sólo los rechazos 4xx se traducen a un error público. Un 5xx es un fallo del proveedor,
 * no del cliente: no es accionable para el agente, es el que más diagnóstico interno
 * arrastra, y debe seguir reportándose aguas arriba como 502 para que reintentos, alertas
 * y métricas basadas en 5xx sigan disparándose.
 *
 * @param {any} response - Valor que quedó en el contexto bajo `channel_hub.<send|reply>_response`.
 * @returns {boolean}
 */
export function isChannelHubRejection(response) {
    return (
        Number.isInteger(response?.status) &&
        response.status >= 400 &&
        response.status < 500 &&
        Boolean(response?.detail)
    );
}

/**
 * Único punto por el que el `detail` de Channel Hub se convierte en texto público: trunca
 * aquí para que ningún caso de uso futuro pueda reenviar el texto crudo del proveedor.
 *
 * @param {any} response - Respuesta problem+json de Channel Hub.
 * @param {string} publicErrorCode - Código público del catálogo (@kace/error-codes).
 * @returns {CustomError}
 */
export function channelHubRejectionError(response, publicErrorCode) {
    const detail = String(response.detail).slice(0, MAX_PUBLIC_DETAIL_LENGTH);
    return new CustomError(detail, 400, null, publicErrorCode);
}
