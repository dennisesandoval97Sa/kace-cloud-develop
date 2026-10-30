export class OneScriptResponse {
    /** @type {OneScript} is initialized in the constructor */
    #oneScript;
    constructor(oneScript) {
        this.#oneScript = oneScript;
    }

    toJson() {
        if (this.#oneScript === null) return {};
        return {
            data: {
                id: this.#oneScript.id.value,
                url: this.#oneScript.url.value,
                url_api: this.#oneScript.url_api.value,
                name: this.#oneScript.name.value,
                schema_id: this.#oneScript.schema_id.value,
                onescript_reference_id: this.#oneScript.onescript_reference_id.value,
                created_at: this.#oneScript.created_at.value,
                updated_at: this.#oneScript.updated_at.value,
                created_by: this.#oneScript.created_by.value,
                updated_by: this.#oneScript.updated_by.value,
            },
        };
    }
}
