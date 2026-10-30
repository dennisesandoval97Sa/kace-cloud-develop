import { describe, expect, it } from "vitest";

import {
    dedupeSelectOptionsKeepingLast,
    mergeEnsuredSelectOptions,
} from "@kace_v2/shared/utils/mergeEnsuredSelectOptions.util";

describe("mergeEnsuredSelectOptions", () => {
    it("pone al inicio la opcion asegurada cuando no esta en la primera pagina", () => {
        const merged = mergeEnsuredSelectOptions(
            [{ label: "Fuera de pagina", value: "kept" }],
            [{ label: "Primera", value: "page-1" }],
        );

        expect(merged).toEqual([
            { label: "Fuera de pagina", value: "kept" },
            { label: "Primera", value: "page-1" },
        ]);
    });

    it("cuando la opcion llega en una pagina posterior queda una sola vez en esa posicion", () => {
        const merged = mergeEnsuredSelectOptions(
            [{ label: "Fuera de pagina", value: "kept" }],
            [
                { label: "Primera", value: "page-1" },
                { label: "Fuera de pagina", value: "kept" },
                { label: "Siguiente", value: "page-2" },
            ],
        );

        expect(merged.filter((option) => option.value === "kept")).toHaveLength(1);
        expect(merged).toEqual([
            { label: "Primera", value: "page-1" },
            { label: "Fuera de pagina", value: "kept" },
            { label: "Siguiente", value: "page-2" },
        ]);
    });

    it("si la lista ya trae la opcion al inicio y otra vez en la pagina, deja la paginada", () => {
        expect(
            dedupeSelectOptionsKeepingLast([
                { label: "Fuera de pagina", value: "kept" },
                { label: "Primera", value: "page-1" },
                { label: "Fuera de pagina", value: "kept" },
                { label: "Siguiente", value: "page-2" },
            ]),
        ).toEqual([
            { label: "Primera", value: "page-1" },
            { label: "Fuera de pagina", value: "kept" },
            { label: "Siguiente", value: "page-2" },
        ]);
    });
});
