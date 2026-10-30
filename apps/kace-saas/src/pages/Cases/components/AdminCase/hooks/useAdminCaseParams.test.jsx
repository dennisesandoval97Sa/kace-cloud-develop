import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import useAdminCaseParams from "./useAdminCaseParams";

const renderAt = (path) =>
    renderHook(() => useAdminCaseParams(), {
        wrapper: ({ children }) => <MemoryRouter initialEntries={[path]}>{children}</MemoryRouter>,
    }).result.current;

describe("useAdminCaseParams — roleNamespace", () => {
    it("usa el namespace 'agente' en el módulo de agente", () => {
        expect(renderAt("/agent/update/case-1").roleNamespace).toBe("agente");
    });

    it("usa el namespace 'administrador' en el módulo de administrador", () => {
        expect(renderAt("/cases/update/case-1").roleNamespace).toBe("administrador");
    });
});
