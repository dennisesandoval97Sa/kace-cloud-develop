export class CommentResponse {
    /** @type {Comment} is initialized in the constructor*/
    #comment;

    constructor(comment) {
        this.#comment = comment;
    }

    /**
     * Converts the Comment object to a JSON representation.
     *
     * @returns {Object} A plain object containing the Comment data.
     */
    toJson() {
        return {
            data: {
                id: this.#comment.id.value,
                descripcion: this.#comment.descripcion.value,
                calificacion: this.#comment.calificacion.value,
                created_at: this.#comment.created_at.value,
                updated_at: this.#comment.updated_at.value,
                created_by: this.#comment.created_by.value,
                updated_by: this.#comment.updated_by.value,
                creator: this.#comment.creator === null ? null : this.#comment.creator.toJson(),
            },
        };
    }
}
