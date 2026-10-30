import { describe, it, expect, vi } from "vitest";

vi.mock("i18next", () => ({
    t: (key) =>
        ({
            "app.forms.active": "Activo",
            "app.forms.inactive": "Inactivo",
            "boards.list.creatorTag": "(creador)",
        })[key] ?? key,
}));

vi.mock("@/utils/main", () => ({
    handleState: (rows) =>
        rows.map((row) => ({
            ...row,
            is_active: row.is_active ? "Activo" : "Inactivo",
        })),
    handleStateTimer: (rows) => rows,
}));

const { normalizeBoardRow, processData, processColumns, processFilters } =
    await import("@kace_v2/features/boards/utils/boardsDatatableProcess");

const board = (overrides = {}) => ({
    id: "board-1",
    name: "Tablero",
    is_active: true,
    access_users: ["user-1"],
    access_groups: ["group-1"],
    ...overrides,
});

describe("boardsDatatableProcess — normalizeBoardRow", () => {
    it("deja is_active crudo para que handleState traduzca como el resto de listados", () => {
        expect(normalizeBoardRow(board({ is_active: true })).is_active).toBe(true);
    });

    it("vuelca los nombres resueltos por el backend sobre las columnas de acceso", () => {
        const row = normalizeBoardRow(
            board({
                access_users_data: [{ id: "user-1", nombre: "Ana Perez" }],
                access_groups_data: [{ id: "group-1", nombre: "Operaciones" }],
            }),
        );

        expect(row.access_users).toEqual([{ id: "user-1", nombre: "Ana Perez" }]);
        expect(row.access_groups).toEqual([{ id: "group-1", nombre: "Operaciones" }]);
    });

    it("marca al creador en la etiqueta del chip", () => {
        const row = normalizeBoardRow(
            board({
                access_users_data: [
                    { id: "user-1", nombre: "Ana Perez", is_creator: true },
                    { id: "user-2", nombre: "Luis Galvan" },
                ],
            }),
        );

        expect(row.access_users).toEqual([
            { id: "user-1", nombre: "Ana Perez (creador)", is_creator: true },
            { id: "user-2", nombre: "Luis Galvan" },
        ]);
    });

    it("deja las columnas de acceso vacias cuando el backend no resolvio nombres", () => {
        const row = normalizeBoardRow(board());

        // Sin esto la celda recibiria el array de ids crudos y pintaria uuids.
        expect(row.access_users).toEqual([]);
        expect(row.access_groups).toEqual([]);
    });
});

describe("boardsDatatableProcess — processData", () => {
    it("normaliza el array que ya desempaqueta useDataTable", async () => {
        const rows = await processData([board({ is_active: true })]);
        expect(rows).toHaveLength(1);
        expect(rows[0].is_active).toBe("Activo");
    });

    it("devuelve un array vacio cuando no llega un array", async () => {
        await expect(processData(null)).resolves.toEqual([]);
        await expect(processData({ data: [board()] })).resolves.toEqual([]);
    });
});

describe("boardsDatatableProcess — columnas y filtros", () => {
    it("declara los pseudo-campos de acceso que BoardSearcher sabe extraer", () => {
        const columns = processColumns({});

        expect(columns.access_users({}).filterData).toMatchObject({
            field: "access_users_ids",
            operator: "in",
        });
        expect(columns.access_groups({}).filterData).toMatchObject({
            field: "access_groups_ids",
            operator: "in",
        });
    });

    it("cualifica con la tabla los filtros de texto, que si son columnas reales", () => {
        const columns = processColumns({});

        expect(columns.name({}).filterData).toMatchObject({ field: "boards.name", operator: "ilike" });
        expect(columns.description({}).filterData).toMatchObject({
            field: "boards.description",
            operator: "ilike",
        });
        expect(columns.primary_entity({}).filterData).toMatchObject({
            field: "boards.primary_entity",
            operator: "ilike",
        });
    });

    it("filtra is_active por igualdad, no por ilike", () => {
        const columns = processColumns({});

        expect(columns.is_active({}).filterData).toMatchObject({ field: "boards.is_active", operator: "eq" });
    });

    it("deja display_order fuera del modal de filtros", () => {
        // DataTableFilters descarta las columnas sin filterData; solo aporta la cabecera.
        const column = processColumns({}).display_order({});

        expect(column.filterData).toBeUndefined();
        expect(column.label).toBe("displayOrder");
    });

    it("no permite ordenar por las columnas de acceso", () => {
        const columns = processColumns({});

        expect(columns.access_users({}).enableSorting).toBe(false);
        expect(columns.access_groups({}).enableSorting).toBe(false);
    });

    it("conserva los filtros por defecto y anade el switch de is_active", () => {
        const previous = { column_name: "created_at" };

        expect(processFilters([previous])).toEqual([previous, { column_name: "is_active", field: "switch_state" }]);
    });
});
