import { beforeEach, describe, expect, it, vi } from "vitest";
import { fetchDelete } from "./deleteService";
import { apiService } from "@/utils/main";

vi.mock("@/utils/main", () => ({
    apiService: {
        get: vi.fn(),
    },
}));

describe("fetchDelete", () => {
    beforeEach(() => {
        apiService.get.mockReset();
    });

    it("builds the delete URL from the service URL and the id", async () => {
        apiService.get.mockResolvedValue({ status: 200, data: {} });

        await fetchDelete("board-1", "/boards");

        expect(apiService.get).toHaveBeenCalledWith("/boards/board-1/delete");
    });

    it("resolves for a 200 response", async () => {
        apiService.get.mockResolvedValue({ status: 200, data: {} });

        await expect(fetchDelete("board-1", "/boards")).resolves.toBe(true);
    });

    /*
     * Antes un 204 devolvia `false`, que react-query trataba igualmente como exito. Se acepta cualquier
     * 2xx para que ningun borrado correcto pase a reportarse como fallo al propagar los errores.
     */
    it("resolves for any 2xx response", async () => {
        apiService.get.mockResolvedValue({ status: 204, data: null });

        await expect(fetchDelete("board-1", "/boards")).resolves.toBe(true);
    });

    it("resolves when the payload reports Success outside the 2xx range", async () => {
        apiService.get.mockResolvedValue({ status: 302, data: { message: "Success" } });

        await expect(fetchDelete("board-1", "/boards")).resolves.toBe(true);
    });

    it("does not throw a TypeError when the response carries no payload", async () => {
        apiService.get.mockResolvedValue({ status: 200 });

        await expect(fetchDelete("board-1", "/boards")).resolves.toBe(true);
    });

    /*
     * El contrato que hace alcanzable el onError de useGeneralDelete: un fallo HTTP tiene que llegar a
     * react-query como rechazo. Mientras el servicio lo atrapaba, la mutacion siempre entraba en
     * onSuccess y mostraba un toast de exito aunque el borrado hubiera fallado.
     */
    it("propagates the rejection when the request fails", async () => {
        const httpError = Object.assign(new Error("Request failed with status code 500"), {
            response: { status: 500, data: { message: "internal_error" } },
        });
        apiService.get.mockRejectedValue(httpError);

        await expect(fetchDelete("board-1", "/boards")).rejects.toThrow("Request failed with status code 500");
    });

    it("throws with the payload message when the response is not a success", async () => {
        apiService.get.mockResolvedValue({ status: 302, data: { message: "board_in_use" } });

        await expect(fetchDelete("board-1", "/boards")).rejects.toThrow("board_in_use");
    });

    it("throws a generic error when the unsuccessful response carries no message", async () => {
        apiService.get.mockResolvedValue({ status: 302, data: {} });

        await expect(fetchDelete("board-1", "/boards")).rejects.toThrow("delete_failed");
    });
});
