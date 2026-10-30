import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { ReassignCaseFields } from "./ReassignCaseFields";
import { genericSearchService } from "@/services/genericSearchService";

let capturedSelectProps = {};

vi.mock("react-i18next", () => ({
    useTranslation: () => ({ t: (k) => k }),
}));

vi.mock("@/hooks/useConfigAgentData", () => ({
    default: () => ({
        reassignFilterActiveUsers: false,
        reassignIncludeDefaultAssignees: false,
        active_session_limit: 10,
    }),
}));

vi.mock("@/services/genericSearchService", () => ({
    genericSearchService: vi.fn(),
}));

vi.mock("@/componentsV2/lib/SelectFromQuery", () => ({
    default: (props) => {
        capturedSelectProps[props.name] = props;
        return <div data-testid={`mock-select-${props.name}`} data-filter={JSON.stringify(props.filter)} />;
    },
}));

describe("ReassignCaseFields", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedSelectProps = {};
    });

    it("pasa los filtros status=1 y deleted_at=null al SelectFromQuery de grupos cuando tipo es 1", () => {
        const values = { tipo: "1", grupo_id: "", usuario_id: "" };
        render(<ReassignCaseFields errors={{}} touched={{}} values={values} setFieldValue={vi.fn()} />);

        const groupSelect = capturedSelectProps.grupo_id;
        expect(groupSelect).toBeDefined();
        expect(groupSelect.filter).toContainEqual({
            field: "status",
            operator: "eq",
            value: 1,
            type: "AND",
        });
        expect(groupSelect.filter).toContainEqual({
            field: "deleted_at",
            operator: "null",
            value: "null",
            type: "AND",
        });
    });

    it("pasa los filtros is_active=1 y deleted_at=null al SelectFromQuery de usuarios cuando tipo es 2", () => {
        const values = { tipo: "2", grupo_id: "", usuario_id: "" };
        render(<ReassignCaseFields errors={{}} touched={{}} values={values} setFieldValue={vi.fn()} />);

        const userSelect = capturedSelectProps.usuario_id;
        expect(userSelect).toBeDefined();
        expect(userSelect.filter).toContainEqual({
            field: "is_active",
            operator: "eq",
            value: "1",
            type: "AND",
        });
        expect(userSelect.filter).toContainEqual({
            field: "deleted_at",
            operator: "null",
            value: "null",
            type: "AND",
        });
    });

    it("incluye is_active=1 y deleted_at=null en handleUserSearch cuando el usuario busca por texto", async () => {
        genericSearchService.mockResolvedValueOnce({ data: [] });
        const values = { tipo: "2", grupo_id: "", usuario_id: "" };
        render(<ReassignCaseFields errors={{}} touched={{}} values={values} setFieldValue={vi.fn()} />);

        const userSelect = capturedSelectProps.usuario_id;
        expect(userSelect).toBeDefined();
        await userSelect.onSearch("Carlos");

        expect(genericSearchService).toHaveBeenCalled();
        const sentFilters = genericSearchService.mock.calls[0][1];
        expect(sentFilters).toContainEqual({
            field: "is_active",
            operator: "eq",
            value: "1",
            type: "AND",
        });
        expect(sentFilters).toContainEqual({
            field: "deleted_at",
            operator: "null",
            value: "null",
            type: "AND",
        });
    });

    it("pasa los filtros usuario_id y grupos.status=1 al SelectFromQuery de grupos del usuario cuando tipo es 2 y hay usuario_id", () => {
        const values = { tipo: "2", grupo_id: "", usuario_id: "user-123" };
        render(<ReassignCaseFields errors={{}} touched={{}} values={values} setFieldValue={vi.fn()} />);

        const userRelatedGroupSelect = capturedSelectProps.grupo_id;
        expect(userRelatedGroupSelect).toBeDefined();
        expect(userRelatedGroupSelect.filter).toContainEqual({
            field: "usuario_id",
            operator: "eq",
            value: "user-123",
            type: "AND",
        });
        expect(userRelatedGroupSelect.filter).toContainEqual({
            field: "grupos.status",
            operator: "eq",
            value: 1,
            type: "AND",
        });
    });
});
