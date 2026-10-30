import { render } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import AuxClientsFilterPreviewDataTable from "./AuxClientsFilterPreviewDataTable";
import { activeClientsFilter, clientDataTableConfig, clientsAuxRelationship } from "../data/aux_clients";
import {
    processData,
    qualifyFilterField,
    normalizeClientFilters,
    hasAuxiliaryFilter,
    buildClientsSearchQuery,
} from "../utils/clientsDataTable";
import useDataTable from "@/hooks/useDataTable";

vi.mock("@/componentsV2/core/DataTable", () => ({
    default: ({ renderData }) => <div data-testid="data-table">{renderData ? "loaded" : "empty"}</div>,
}));

vi.mock("@/hooks/useDataTable");

describe("MassiveExecution - AuxClientsFilterPreviewDataTable & clientsDataTable", () => {
    describe("clientsDataTable: processData", () => {
        it("should map rows straight through, since the search is already based on clients", () => {
            const rawData = {
                data: [{ id: "client-2", nombres: "Ana", documento: "987654", status: 1 }],
            };

            const result = processData(rawData);

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe("client-2");
            expect(result[0].nombres).toBe("Ana");
            expect(result[0].documento).toBe("987654");
        });

        it("should keep the joined auxiliary row available under relations", () => {
            const auxRow = { id: "aux-1", cliente_id: "client-1", data: { ciudad: "Medellin" } };
            const rawData = { data: [{ id: "client-1", nombres: "Carlos", relations: { aux_clients: auxRow } }] };

            const result = processData(rawData);

            expect(result[0].id).toBe("client-1");
            expect(result[0].relations.aux_clients).toEqual(auxRow);
        });

        it("should return empty array gracefully if data is null or undefined", () => {
            expect(processData(null)).toEqual([]);
            expect(processData(undefined)).toEqual([]);
        });
    });

    describe("clientsDataTable: qualifyFilterField", () => {
        it("should qualify a bare client column with the clients table", () => {
            expect(qualifyFilterField("documento")).toBe("clients.documento");
        });

        it("should map the auxiliary form's bare 'data' field onto aux_clients", () => {
            expect(qualifyFilterField("data")).toBe("aux_clients.data");
        });

        it("should leave an already qualified field untouched", () => {
            expect(qualifyFilterField("clients.nombres")).toBe("clients.nombres");
            expect(qualifyFilterField("aux_clients.data")).toBe("aux_clients.data");
        });
    });

    describe("clientsDataTable: normalizeClientFilters", () => {
        it("should qualify every filter field without touching the rest of the filter", () => {
            const filters = [
                { field: "documento", operator: "eq", type: "AND", value: "123" },
                { field: "data", operator: "jsonContains", type: "AND", value: '{"vip":true}' },
            ];

            expect(normalizeClientFilters(filters)).toEqual([
                { field: "clients.documento", operator: "eq", type: "AND", value: "123" },
                { field: "aux_clients.data", operator: "jsonContains", type: "AND", value: '{"vip":true}' },
            ]);
        });

        it("should return empty array for non-array inputs", () => {
            expect(normalizeClientFilters(null)).toEqual([]);
            expect(normalizeClientFilters(undefined)).toEqual([]);
        });
    });

    describe("clientsDataTable: hasAuxiliaryFilter", () => {
        it("should return false for native client filters or empty/invalid inputs", () => {
            expect(hasAuxiliaryFilter([])).toBe(false);
            expect(hasAuxiliaryFilter(null)).toBe(false);
            expect(hasAuxiliaryFilter(undefined)).toBe(false);
            expect(hasAuxiliaryFilter([{ field: "documento" }])).toBe(false);
            expect(hasAuxiliaryFilter([{ field: "clients.nombres" }])).toBe(false);
        });

        it("should return true when data or aux_clients fields are present", () => {
            expect(hasAuxiliaryFilter([{ field: "data" }])).toBe(true);
            expect(hasAuxiliaryFilter([{ field: "aux_clients.data" }])).toBe(true);
            expect(hasAuxiliaryFilter([{ field: "clients.documento" }, { field: "data" }])).toBe(true);
        });
    });

    describe("clientsDataTable: buildClientsSearchQuery", () => {
        it("should omit aux_clients relationship when filtering only by native client columns", () => {
            const query = buildClientsSearchQuery([{ field: "documento", operator: "ilike", type: "AND", value: "1" }]);

            expect(query.relationship).toBeUndefined();
            expect(query.filter).toEqual([
                { field: "clients.documento", operator: "ilike", type: "AND", value: "1" },
                activeClientsFilter,
            ]);
        });

        it("should attach aux_clients relationship when filtering by auxiliary data", () => {
            const query = buildClientsSearchQuery([
                { field: "data", operator: "jsonContains", type: "AND", value: '{"ciudad":"Medellin"}' },
            ]);

            expect(query.relationship).toBe(clientsAuxRelationship);
            expect(query.filter).toEqual([
                { field: "aux_clients.data", operator: "jsonContains", type: "AND", value: '{"ciudad":"Medellin"}' },
                activeClientsFilter,
            ]);
        });
    });

    describe("AuxClientsFilterPreviewDataTable component", () => {
        beforeEach(() => {
            vi.clearAllMocks();
            useDataTable.mockReturnValue({
                renderData: [],
                query: { refetch: vi.fn() },
                pagination: {},
            });
        });

        it.each([
            ["a native client filter", { field: "documento", operator: "eq", type: "AND", value: "102030" }, undefined],
            [
                "an auxiliary data filter",
                { field: "data", operator: "jsonContains", type: "AND", value: '{"vip":true}' },
                clientsAuxRelationship,
            ],
        ])("should query clients with appropriate relationship for %s", (_label, filter, expectedRelationship) => {
            render(<AuxClientsFilterPreviewDataTable tableFilters={[filter]} />);

            expect(useDataTable).toHaveBeenCalledTimes(1);
            const callArgs = useDataTable.mock.calls[0][0];

            expect(callArgs.dataTableConfig).toBe(clientDataTableConfig);
            expect(callArgs.relationship).toBe(expectedRelationship);
            expect(callArgs.tableFilters).toEqual(buildClientsSearchQuery([filter]).filter);
        });
    });
});
