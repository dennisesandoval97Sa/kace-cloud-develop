import { Uuid } from "@kace/plugins";

/**
 * buildAuxClientsRoutesObjects(schema, baseRoute = "aux_clients")
 * - Mantiene la lógica pedida: base aux_clients, fields sin data_structure van a la ruta actual,
 *   keys con data_structure generan rutas hijas (path|key) y se recorren recursivamente.
 * - Retorna un array de objetos: { id, route, fields: [{id, label, type}, ...] }
 */
export function buildAuxClientsRoutesObjects (schema, baseRoute = "aux_clients") {
    function inferType (value) {
        if (value && typeof value === "object" && !Array.isArray(value) && "type" in value) return String(value.type);
        if (typeof value === "boolean") return "boolean";
        if (typeof value === "number") return "number";
        if (typeof value === "string") return "string";
        if (value === null) return "null";
        if (Array.isArray(value)) return "array";
        if (value && typeof value === "object") return "object";
        return "unknown";
    }

    const results = { routes: [], fields: [] };

    function traverse (node, path) {
        const ds =
            node && typeof node === "object" && "data_structure" in node && typeof node.data_structure === "object"
                ? node.data_structure
                : node;
        if (!ds || typeof ds !== "object") return;

        const directFields = [];
        const children = [];

        for (const key of Object.keys(ds)) {
            const val = ds[key];
            if (val && typeof val === "object" && "data_structure" in val) {
                children.push([key, val.data_structure]);
            } else {
                directFields.push([key, val]);
            }
        }

        const routeObj = { id: Uuid(), label: path };
        for (const [k, v] of directFields) {
            results.fields.push({ id: Uuid(), routeId: routeObj.id, label: k, type: inferType(v) });
        }
        results.routes.push(routeObj);

        for (const [childKey, childDs] of children) {
            traverse(childDs, `${path}|${childKey}`);
        }
    }

    traverse(schema, baseRoute);
    return results;
}
