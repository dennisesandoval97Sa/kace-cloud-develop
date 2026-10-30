/**
 * Representación de un enlace rápido para la API.
 *
 * Expone únicamente los campos necesarios,
 * sin incluir información interna de auditoría.
 */
export class QuickLinkResponse {
    constructor(quickLink) {
        this.id = quickLink.id.value;
        this.title = quickLink.title.value;
        this.url = quickLink.url.value;
        this.position = quickLink.position.value;
    }

    toJson() {
        return {
            id: this.id,
            title: this.title,
            url: this.url,
            position: this.position,
        };
    }
}
