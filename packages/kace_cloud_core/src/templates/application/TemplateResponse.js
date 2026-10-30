export class TemplateResponse {
    /** @type {Template} is initialized in the constructor */
    #template;
    constructor(template) {
        this.#template = template;
    }
    /**
     * Converts the Template object to a JSON representation.
     *
     * @returns {Object} A plain object containing the Template data.
     */
    toJson() {
        return {
            data: {
                id: this.#template.id.value,
                descripcion: this.#template.descripcion.value,
                ruta: this.#template.ruta.value,
                tipo: this.#template.tipo.value,
                destinatario: this.#template.destinatario.value,
                copia: this.#template.copia.value,
                copia_oculta: this.#template.copia_oculta.value,
                asunto: this.#template.asunto.value,
                cuerpo: this.#template.cuerpo.value,
                incluye_adjuntos: this.#template.incluye_adjuntos.value,
                enviar_adjuntos_del_caso: this.#template.enviar_adjuntos_del_caso.value,
                status: this.#template.status.value,
                created_at: this.#template.created_at.value,
                updated_at: this.#template.updated_at.value,
                created_by: this.#template.created_by.value,
                updated_by: this.#template.updated_by.value,
            },
        };
    }
}
