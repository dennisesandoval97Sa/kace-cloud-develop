import { describe, expect, it } from "vitest";
import {
    pickRestorableFilterValues,
    resolveDateFilterOperator,
} from "../../../../../components/ui-shared/src/components/table-component/helpers";
import { createCasesFilterCriterionResolver } from "./transformNivelFilters";

describe("saved filter restore use cases", () => {
    it("restores dates, classification level, and strings into criteria", () => {
        const saved = {
            fecha_vencimiento: "2026-07-01T00:00:00.000Z, 2026-07-01T23:59:59.999Z",
            created_at: "2026-06-01T00:00:00.000Z, 2026-06-30T23:59:59.999Z",
            nivel1: "nivel3/Soporte",
            reference: "99",
            nombres: "Ana",
            orphan_field: "ignore-me",
        };
        const known = [
            "fecha_vencimiento",
            "created_at",
            "fecha_resolucion",
            "updated_at",
            "nivel1",
            "reference",
            "nombres",
            "estadoActual",
        ];

        const restored = pickRestorableFilterValues(saved, known);
        expect(restored).not.toHaveProperty("orphan_field");

        const resolve = createCasesFilterCriterionResolver({ isCustomView: false });
        const criteria = Object.entries(restored).map(([field, value]) => {
            const operator = resolveDateFilterOperator(field);
            const resolved = resolve({ field, value });
            return { ...resolved, operator: operator ?? resolved?.operator ?? "ilike" };
        });

        expect(criteria).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: "cases.sla_due_date", operator: "between" }),
                expect.objectContaining({
                    field: "clasificaciones.nivel3",
                    value: "Soporte",
                    operator: "ilike",
                }),
                expect.objectContaining({ field: "reference", value: 99, operator: "eq" }),
            ]),
        );
    });

    it("restores estadoActual from form columns when schema still uses estado_actual", () => {
        const saved = { estadoActual: "ESCALADO BO", orphan: "x" };
        const formColumns = ["estadoActual", "reference", "grupo_nombre"];
        const restored = pickRestorableFilterValues(saved, formColumns);
        expect(restored).toEqual({ estadoActual: "ESCALADO BO" });

        const resolve = createCasesFilterCriterionResolver({ isCustomView: false });
        expect(resolve({ field: "estadoActual", value: restored.estadoActual })).toEqual({
            field: "estados.nombre",
            value: "ESCALADO BO",
        });
    });

    it("does not rewrite joined aliases on the custom view path", () => {
        const resolve = createCasesFilterCriterionResolver({ isCustomView: true });
        expect(resolve({ field: "fecha_vencimiento", value: "a, b" })).toEqual({
            field: "fecha_vencimiento",
            value: "a, b",
        });
        expect(resolve({ field: "grupo_nombre", value: "BO" })).toEqual({
            field: "grupo_nombre",
            value: "BO",
        });
        expect(resolve({ field: "estado_id", value: "uuid" })).toEqual({
            field: "estado_id",
            value: "uuid",
            operator: "eq",
        });
    });
});
