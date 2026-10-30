import { describe, expect, it } from "vitest";
import {
    appendUniqueOptions,
    computeHasNextPage,
    filterOptionsByLabel,
    mapRawItemsToOptions,
    mergeSeedIntoOptions,
    resolveFieldName,
    seedOptionFromInitialValue,
    shouldIncludeSeedInOptions,
    sortOptionsAlphabetically,
} from "./selectByProviderOptions";

describe("resolveFieldName", () => {
    it("prefers explicitField", () => {
        expect(resolveFieldName("nombre", "codigo")).toBe("codigo");
    });

    it("uses string labelFrom when no explicit field", () => {
        expect(resolveFieldName("nombre", undefined)).toBe("nombre");
    });

    it("uses first entry when labelFrom is an array", () => {
        expect(resolveFieldName(["nombre", "codigo"], undefined)).toBe("nombre");
    });
});

describe("mapRawItemsToOptions item mapping", () => {
    it("reads nested valueFrom/labelFrom paths", () => {
        expect(
            mapRawItemsToOptions([{ estado: { id: "1", nombre: "Abierto" } }], {
                valueFrom: "estado.id",
                labelFrom: "estado.nombre",
            }),
        ).toEqual([{ value: "1", label: "Abierto" }]);
    });

    it("does not throw when an intermediate object of a nested path is null", () => {
        expect(
            mapRawItemsToOptions([{ estado: null }], { valueFrom: "estado.id", labelFrom: "estado.nombre" }),
        ).toEqual([{ value: null, label: "" }]);
    });

    it("joins the non-empty fields of an array labelFrom", () => {
        expect(
            mapRawItemsToOptions([{ id: "1", nombres: "Ana", apellido: "" }], { labelFrom: ["nombres", "apellido"] }),
        ).toEqual([{ value: "1", label: "Ana" }]);
    });

    it("maps a string to itself and drops anything else", () => {
        expect(mapRawItemsToOptions(["CC", 7, null])).toEqual([{ value: "CC", label: "CC" }]);
    });
});

describe("seedOptionFromInitialValue", () => {
    const opts = { valueFrom: "id", labelFrom: "description" };

    it("maps the saved value to an option", () => {
        expect(seedOptionFromInitialValue({ id: "2", description: "Horario B" }, opts)).toEqual({
            value: "2",
            label: "Horario B",
        });
    });

    it.each([
        ["no value", { id: null, description: "Horario B" }],
        ["an empty value", { id: "", description: "Horario B" }],
        ["no label", { id: "2", description: "" }],
        ["an empty object", {}],
        ["null", null],
        ["undefined", undefined],
    ])("returns null for a saved value with %s", (_case, initialValue) => {
        expect(seedOptionFromInitialValue(initialValue, opts)).toBeNull();
    });
});

describe("mapRawItemsToOptions", () => {
    it("maps id/nombre to value/label", () => {
        expect(mapRawItemsToOptions([{ id: "1", nombre: "Zeta" }], { valueFrom: "id", labelFrom: "nombre" })).toEqual([
            { value: "1", label: "Zeta" },
        ]);
    });

    it("joins array labelFrom with spaces", () => {
        expect(
            mapRawItemsToOptions([{ id: "1", a: "Foo", b: "Bar" }], { valueFrom: "id", labelFrom: ["a", "b"] }),
        ).toEqual([{ value: "1", label: "Foo Bar" }]);
    });

    it("resolves dotted valueFrom paths", () => {
        expect(
            mapRawItemsToOptions([{ nested: { id: "9" }, nombre: "Nested" }], {
                valueFrom: "nested.id",
                labelFrom: "nombre",
            }),
        ).toEqual([{ value: "9", label: "Nested" }]);
    });
});

describe("shouldIncludeSeedInOptions", () => {
    it("includes seed when there is no search term", () => {
        expect(shouldIncludeSeedInOptions({ value: "1", label: "Flujo Norte" }, "")).toBe(true);
    });

    it("includes seed only when its label matches the search term", () => {
        expect(shouldIncludeSeedInOptions({ value: "1", label: "Flujo Norte" }, "norte")).toBe(true);
        expect(shouldIncludeSeedInOptions({ value: "1", label: "Flujo Norte" }, "sur")).toBe(false);
    });
});

describe("mergeSeedIntoOptions", () => {
    it("appends seed when missing from page options", () => {
        expect(mergeSeedIntoOptions([{ value: "2", label: "B" }], { value: "1", label: "A" })).toEqual([
            { value: "2", label: "B" },
            { value: "1", label: "A" },
        ]);
    });

    it("dedupes seed already present (keeps page label)", () => {
        expect(mergeSeedIntoOptions([{ value: "1", label: "From page" }], { value: "1", label: "From seed" })).toEqual([
            { value: "1", label: "From page" },
        ]);
    });

    it("returns options unchanged when seed is null", () => {
        const options = [{ value: "1", label: "A" }];
        expect(mergeSeedIntoOptions(options, null)).toEqual(options);
    });

    it("prepends the seed when asked to", () => {
        expect(
            mergeSeedIntoOptions([{ value: "2", label: "B" }], { value: "1", label: "A" }, { prepend: true }),
        ).toEqual([
            { value: "1", label: "A" },
            { value: "2", label: "B" },
        ]);
    });

    it.each([null, undefined, ""])("skips a seed whose value is %p even when it has a label", (value) => {
        const options = [{ value: "1", label: "A" }];
        expect(mergeSeedIntoOptions(options, { value, label: "Turno Nocturno" }, { prepend: true })).toBe(options);
    });

    it("dedupes a seed whose value has a different type than the listed one", () => {
        const options = [{ value: 5, label: "From page" }];
        expect(mergeSeedIntoOptions(options, { value: "5", label: "From seed" }, { prepend: true })).toBe(options);
    });
});

describe("appendUniqueOptions", () => {
    it("appends the new page after the loaded options", () => {
        expect(appendUniqueOptions([{ value: "1", label: "A" }], [{ value: "2", label: "B" }])).toEqual([
            { value: "1", label: "A" },
            { value: "2", label: "B" },
        ]);
    });

    it("skips values already loaded, even when the page returns them with another type", () => {
        const previous = [
            { value: "1", label: "A" },
            { value: 2, label: "B" },
        ];
        expect(
            appendUniqueOptions(previous, [
                { value: 1, label: "A again" },
                { value: "2", label: "B again" },
                { value: "3", label: "C" },
            ]),
        ).toEqual([...previous, { value: "3", label: "C" }]);
    });
});

describe("sortOptionsAlphabetically", () => {
    it("sorts by label ascending with localeCompare", () => {
        expect(
            sortOptionsAlphabetically([
                { value: "2", label: "zeta" },
                { value: "1", label: "Alfa" },
            ]),
        ).toEqual([
            { value: "1", label: "Alfa" },
            { value: "2", label: "zeta" },
        ]);
    });
});

describe("filterOptionsByLabel", () => {
    it("filters case-insensitively by substring", () => {
        expect(
            filterOptionsByLabel(
                [
                    { value: "1", label: "Flujo Norte" },
                    { value: "2", label: "Sur" },
                ],
                "norte",
            ),
        ).toEqual([{ value: "1", label: "Flujo Norte" }]);
    });

    it("returns all options when query is blank", () => {
        const options = [{ value: "1", label: "A" }];
        expect(filterOptionsByLabel(options, "  ")).toEqual(options);
    });
});

describe("computeHasNextPage", () => {
    it("uses total when provided", () => {
        expect(computeHasNextPage({ accumulatedCount: 20, pageSize: 20, total: 45, lastPageCount: 20 })).toBe(true);
        expect(computeHasNextPage({ accumulatedCount: 45, pageSize: 20, total: 45, lastPageCount: 5 })).toBe(false);
    });

    it("falls back to full last page when total missing", () => {
        expect(computeHasNextPage({ accumulatedCount: 20, pageSize: 20, total: null, lastPageCount: 20 })).toBe(true);
        expect(computeHasNextPage({ accumulatedCount: 15, pageSize: 20, total: null, lastPageCount: 15 })).toBe(false);
    });
});
