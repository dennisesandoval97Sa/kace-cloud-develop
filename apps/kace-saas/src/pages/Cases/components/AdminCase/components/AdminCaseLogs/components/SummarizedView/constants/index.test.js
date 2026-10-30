import { describe, expect, it } from "vitest";
import { eventTypeDetails, resolveConfiguredEventTypes, typeOptions } from "./index";

/**
 * AUD-1 (MSKT-1392): la reclasificación tiene que contarse en la bitácora y poder filtrarse.
 * El backend congela la etiqueta de cada clasificación en el evento (`clasificacion.label`),
 * así que aquí solo se lee; el id crudo nunca debe llegar a la pantalla.
 */
describe("case.reclassified en la bitácora", () => {
    const event = {
        event_name: "case.reclassified",
        old_data: { clasificacion_id: "old-id", clasificacion: { id: "old-id", label: "Soporte -> Red" } },
        body: { clasificacion_id: "new-id", clasificacion: { id: "new-id", label: "Facturación -> Cobro" } },
    };

    it("está registrado, y no cae en el detalle por defecto", () => {
        expect(eventTypeDetails["case.reclassified"]).toBeDefined();
        expect(eventTypeDetails["case.reclassified"]).not.toBe(eventTypeDetails.default);
    });

    it("muestra el diff con las etiquetas, no con los ids", () => {
        const values = eventTypeDetails["case.reclassified"].fields(event).map((field) => field.value);

        expect(values).toContain("Soporte -> Red");
        expect(values).toContain("Facturación -> Cobro");
        expect(values.join(" ")).not.toContain("old-id");
        expect(values.join(" ")).not.toContain("new-id");
    });

    /** Los eventos grabados antes de AUD-1 no llevan etiqueta: se muestran, sin romper la vista. */
    it("cae en el texto de desconocido cuando el evento es anterior a la etiqueta", () => {
        const legacy = { old_data: { clasificacion_id: "old-id" }, body: { clasificacion_id: "new-id" } };

        const values = eventTypeDetails["case.reclassified"].fields(legacy).map((field) => field.value);

        expect(values.join(" ")).not.toContain("old-id");
        expect(values.every((value) => typeof value === "string" && value.length > 0)).toBe(true);
    });

    it("es seleccionable en el filtro por tipo", () => {
        expect(typeOptions.map((option) => option.id)).toContain("case.reclassified");
    });
});

/**
 * Los tenants que guardaron "Seleccionar todos" antes de AUD-1 tienen un snapshot
 * sin `case.reclassified`. Esa lista se aplica como filtro oculto aunque la UI
 * diga "sin filtros", y la reclasificación desaparece de la bitácora.
 */
describe("resolveConfiguredEventTypes", () => {
    it("vacío o ausente significa sin filtro (todos los tipos)", () => {
        expect(resolveConfiguredEventTypes([])).toEqual([]);
        expect(resolveConfiguredEventTypes(undefined)).toEqual([]);
        expect(resolveConfiguredEventTypes(null)).toEqual([]);
    });

    it("añade case.reclassified a una whitelist anterior a AUD-1", () => {
        expect(resolveConfiguredEventTypes(["case.updated", "case.state_changed"])).toEqual([
            "case.updated",
            "case.state_changed",
            "case.reclassified",
        ]);
    });

    it("no duplica case.reclassified si ya está", () => {
        expect(resolveConfiguredEventTypes(["case.reclassified", "case.updated"])).toEqual([
            "case.reclassified",
            "case.updated",
        ]);
    });
});
