import { beforeEach, describe, expect, it, vi } from "vitest";

import { apiService } from "@kace/utils";
import { normalizeQuickLinks, fetchQuickLinks, createQuickLink, deleteQuickLink } from "./quickLinks.service";

vi.mock("@kace/utils", () => ({
    apiService: {
        get: vi.fn(),
        post: vi.fn(),
    },
}));

describe("Quick Links - servicio HTTP", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("normaliza una respuesta data.data con enlaces", () => {
        const links = [{ id: "1" }];
        const response = { data: { data: links } };

        const result = normalizeQuickLinks(response);

        expect(result).toEqual(links);
    });

    it("normaliza una respuesta con items", () => {
        const links = [{ id: "2" }];
        const response = { data: { data: { items: links } } };

        const result = normalizeQuickLinks(response);

        expect(result).toEqual(links);
    });

    it("devuelve una lista vacía cuando la respuesta es nula", () => {
        const response = null;

        const result = normalizeQuickLinks(response);

        expect(result).toEqual([]);
    });

    it("consulta GET /quick-links y normaliza el listado", async () => {
        const links = [{ id: "3" }];
        apiService.get.mockResolvedValue({ data: { data: { items: links } } });

        const result = await fetchQuickLinks();

        expect(apiService.get).toHaveBeenCalledExactlyOnceWith("/quick-links");
        expect(result).toEqual(links);
    });

    it("crea un enlace mediante POST /quick-links", async () => {
        const payload = { title: "Documentación", url: "https://example.com", position: 0 };
        apiService.post.mockResolvedValue({ data: { id: "4" } });

        const response = await createQuickLink(payload);

        expect(apiService.post).toHaveBeenCalledExactlyOnceWith("/quick-links", payload);
        expect(response.data.id).toBe("4");
    });

    it("elimina un enlace utilizando la ruta y codificación correctas", async () => {
        const id = "enlace de ejemplo";
        apiService.get.mockResolvedValue({ status: 200 });

        const response = await deleteQuickLink(id);

        expect(apiService.get).toHaveBeenCalledExactlyOnceWith("/quick-links/enlace%20de%20ejemplo/delete");
        expect(response.status).toBe(200);
    });
});
