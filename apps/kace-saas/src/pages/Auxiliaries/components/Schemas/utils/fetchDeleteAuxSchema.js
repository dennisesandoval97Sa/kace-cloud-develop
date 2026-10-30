import { AUX_SCHEMAS_SERVICE } from "@/utils/URL";
import { apiService } from "@/utils/main";

export async function fetchDeleteAuxSchema (id) {
    try {
        const response = await apiService.get(`${AUX_SCHEMAS_SERVICE}/${id}/delete`);
        return response.status === 200 || response.data.message === "Success";
    } catch {
        // NO-SONAR: En caso de error, se devuelve `false` para indicar que la operación falló sin exponer detalles internos del error.
        return false;
    }
}
