import { globalUserId } from './20241125105900_usuario_base.js';

export const oneScriptBaseFormId = '3b7fa9dc-9694-4f9b-9d2e-097012a1d6cb';

/**
 * @param { import('knex').Knex } knex
 * @returns { Promise<void> }
 */
export async function seed(knex) {
    await knex('one-script').insert({
        id: oneScriptBaseFormId,
        url: "https://onescript.konecta.cloud/render/?schema=4fd81db7-1120-425f-adf8-3adcdaa27011&version=4&stage=dev",
        url_api: "https://api.konecta.cloud/onescript/prd/v1/schema/4fd81db7-1120-425f-adf8-3adcdaa27011/render?version=4&stage=dev",
        name: "Formulario base casos",
        schema_id: null,
        onescript_reference_id: "4fd81db7-1120-425f-adf8-3adcdaa27011",
        "created_at": knex.fn.now(),
        "updated_at": null,
        "created_by": globalUserId,
        "updated_by": null,
    });
}
