const WS_REST_ENDPOINTS_TABLE = 'ws_rest_endpoints';

const SEND_ENDPOINT_ID = 'd0090527-995a-43b0-b195-afe3358a9f53';
const REPLY_ENDPOINT_ID = '880afc61-65d3-445a-a2ba-8c69b51561d6';

// Valores sembrados originalmente por
// seeds/20260525100000_channel_hub_send_email_flow.js y ..._reply_email_flow.js.
// Se guardan aquí para que `down` restaure exactamente el estado previo.
const PREVIOUS_FILTER_INPUT = {
    [SEND_ENDPOINT_ID]: { filter_input: ['messageId'] },
    [REPLY_ENDPOINT_ID]: { filter_input: ['messageId', 'threadId', 'destination', 'subject'] },
};

const FULL_RESPONSE_FILTER_INPUT = { filter_input: [] };

/**
 * Deja que la respuesta completa de Channel Hub llegue al contexto del flujo en los
 * endpoints de envío y respuesta de email.
 *
 * Motivo: `AxiosHttpClient.request()` no lanza ante un error HTTP — mapea `error.response`
 * y la devuelve, así que un 400 de Channel Hub sigue el camino normal del executor. Con
 * `filter_input` no vacío, `WorkflowStepExecutorService.#updateContextFromResponse()` aplica
 * las rutas configuradas sobre el cuerpo; en un 400 ese cuerpo es un problem+json
 * (`{type,title,detail,status,instance}`) que no contiene ninguna de ellas, así que el
 * contexto queda vacío y el motivo real del rechazo se pierde antes de volver a
 * EmailSender/EmailReplier. El agente terminaba viendo un error genérico.
 *
 * Con `filter_input: []` el executor toma la otra rama y vuelca el cuerpo completo en
 * `context_position`, que es exactamente cómo ya está configurado el endpoint de conexión
 * (`seeds/20260324180100_channel_hub_rest_flow.js`) y por lo que MailAccountCreator y
 * ChannelHubAccountRegistrar pueden leer `connection_response.statusCode`.
 *
 * El camino feliz no cambia: los campos que hoy extrae `filter_input` (`messageId`,
 * `threadId`, `destination`, `subject`) están en la raíz del cuerpo de éxito, así que
 * siguen accesibles en la misma ruta del contexto.
 *
 * Es una migración y no una edición del seed porque los seeds insertan con
 * `onConflict('id').ignore()`: en los entornos donde ya corrieron, reeditarlos no tendría
 * ningún efecto.
 *
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function up(knex) {
    await knex(WS_REST_ENDPOINTS_TABLE)
        .whereIn('id', [SEND_ENDPOINT_ID, REPLY_ENDPOINT_ID])
        .update({ filter_input: JSON.stringify(FULL_RESPONSE_FILTER_INPUT) });
}

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function down(knex) {
    for (const [endpointId, filterInput] of Object.entries(PREVIOUS_FILTER_INPUT)) {
        await knex(WS_REST_ENDPOINTS_TABLE)
            .where('id', endpointId)
            .update({ filter_input: JSON.stringify(filterInput) });
    }
}
