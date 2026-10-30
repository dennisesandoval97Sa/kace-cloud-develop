import { describe, it, expect } from "vitest";
import { AdminCaseTransitionsProcessData } from "./AdminCaseTransitionsProcessData";

const formatExpected = (isoString) => {
    if (!isoString) return { date: null, time: null };
    const date = new Date(isoString);
    const optionsDate = { year: "numeric", month: "long", day: "numeric" };
    const formattedDate = date.toLocaleDateString(undefined, optionsDate);
    const optionsTime = {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    };
    const formattedTime = date.toLocaleTimeString(undefined, optionsTime);
    return { date: formattedDate, time: formattedTime };
};

describe("AdminCaseTransitionsProcessData", () => {
    it("should return empty array when data is null, undefined or empty", () => {
        expect(AdminCaseTransitionsProcessData(null)).toEqual([]);
        expect(AdminCaseTransitionsProcessData(undefined)).toEqual([]);
        expect(AdminCaseTransitionsProcessData([])).toEqual([]);
    });

    it("should resolve transition date using item.fecha_transicion when present", () => {
        const transitionDate = "2026-08-05T10:00:00.000Z";
        const data = [
            {
                actualizador: "user-1",
                fecha: "2026-08-04T04:01:42.158Z",
                fecha_transicion: transitionDate,
                estado_siguiente: "EN GESTIÓN",
                fecha_resolucion: null,
            },
        ];

        const result = AdminCaseTransitionsProcessData(data, null, null);
        expect(result[0].fecha).toEqual(formatExpected(transitionDate));
    });

    it("should resolve transition date using caseCreatedAt for first transition when fecha_transicion is null (e.g. closed on first contact)", () => {
        const data = [
            {
                actualizador: "a4d8a498-b061-7088-a553-2803dee11629",
                fecha: "2026-08-04T04:01:42.158Z",
                fecha_transicion: null,
                responsable: {
                    nombres: "Leidy Estefania",
                    apellido1: "Lopez",
                },
                grupo: "URU",
                estado_siguiente: "PRIMER CONTACTO",
                fecha_resolucion: "2026-08-04T04:01:42.709Z",
                transicion_id: "05672b66-fd7c-4ba4-9a63-3cafa3c01ab0",
            },
        ];

        const creatorData = { nombres: "Proceso", apellido1: "Migracion" };
        const caseCreatedAt = "2026-07-13T09:23:27.000Z";

        const result = AdminCaseTransitionsProcessData(data, creatorData, caseCreatedAt);

        expect(result).toHaveLength(1);
        expect(result[0].fecha).toEqual(formatExpected(caseCreatedAt));
        expect(result[0].creador).toEqual(creatorData);
    });

    it("should fallback to caseCreatedAt when item.fecha_transicion and item.fecha are missing on first transition", () => {
        const data = [
            {
                actualizador: "user-1",
                fecha: null,
                fecha_transicion: null,
                estado_siguiente: "PRIMER CONTACTO",
            },
        ];

        const caseCreatedAt = "2026-07-13T09:23:27.000Z";
        const result = AdminCaseTransitionsProcessData(data, null, caseCreatedAt);

        expect(result[0].fecha).toEqual(formatExpected(caseCreatedAt));
    });

    it("should not use item.fecha for intermediate transitions when fecha_transicion is null", () => {
        const firstTransitionDate = "2026-08-01T08:00:00.000Z";
        const data = [
            {
                actualizador: "user-2",
                fecha: "2026-08-10T12:00:00.000Z",
                fecha_transicion: null,
                estado_siguiente: "EN GESTIÓN",
            },
            {
                actualizador: "user-1",
                fecha: "2026-08-01T08:00:00.000Z",
                fecha_transicion: firstTransitionDate,
                estado_siguiente: "ABIERTO",
            },
        ];

        const caseCreatedAt = "2026-07-13T09:23:27.000Z";
        const result = AdminCaseTransitionsProcessData(data, null, caseCreatedAt);

        expect(result[0].fecha).toEqual({ date: null, time: null });
        expect(result[1].fecha).toEqual(formatExpected(firstTransitionDate));
    });

    /**
     * QA-8 (MSKT-1392): la reclasificación es una línea más del timeline, no una lista aparte.
     * Lo que importa es que conserve su sitio entre los cambios de estado y que la marca caiga
     * en la línea que le toca, no en las vecinas.
     */
    describe("línea de reclasificación", () => {
        const timeline = [
            { actualizador: "user-3", fecha_transicion: "2026-08-12T09:00:00.000Z", estado_siguiente: "CERRADO" },
            {
                actualizador: "user-2",
                fecha_transicion: "2026-08-10T12:00:00.000Z",
                estado_siguiente: "EN GESTIÓN",
                es_reclasificacion: true,
                motivo_reclasificacion: "El cliente confirmó la compra",
            },
            { actualizador: "user-1", fecha_transicion: "2026-08-01T08:00:00.000Z", estado_siguiente: "ABIERTO" },
        ];

        it("se queda intercalada entre los cambios de estado, sin reordenar nada", () => {
            const result = AdminCaseTransitionsProcessData(timeline, null, null);

            expect(result.map((item) => item.estado_siguiente)).toEqual(["CERRADO", "EN GESTIÓN", "ABIERTO"]);
            expect(result.map((item) => item.es_reclasificacion)).toEqual([false, true, false]);
        });

        it("conserva el motivo de la línea reclasificada", () => {
            const result = AdminCaseTransitionsProcessData(timeline, null, null);

            expect(result[1].motivo_reclasificacion).toBe("El cliente confirmó la compra");
        });

        it("normaliza las líneas anteriores a AUD-1b, que no traen los campos", () => {
            const result = AdminCaseTransitionsProcessData([{ estado_siguiente: "ABIERTO" }], null, null);

            expect(result[0].es_reclasificacion).toBe(false);
            expect(result[0].motivo_reclasificacion).toBeNull();
        });
    });

    it("should return null date and time if no date source is found", () => {
        const data = [
            {
                actualizador: "user-1",
                fecha: null,
                fecha_transicion: null,
                estado_siguiente: "PRIMER CONTACTO",
            },
        ];

        const result = AdminCaseTransitionsProcessData(data, null, null);

        expect(result[0].fecha).toEqual({ date: null, time: null });
    });
});
