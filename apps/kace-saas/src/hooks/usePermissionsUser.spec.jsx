import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import usePermissionsUser from "./usePermissionsUser";
import useUserInformation from "./useUserInformation";

vi.mock("./useUserInformation", () => ({
    default: vi.fn(),
}));

vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key) =>
            ({
                "app.forms.see": "View",
                "app.forms.edit": "Edit",
                "app.forms.download": "Download",
                "app.forms.delete": "Delete",
            })[key] ?? key,
        i18n: { language: "en" },
    }),
}));

describe("usePermissionsUser", () => {
    beforeEach(() => {
        useUserInformation.mockReset();
    });

    it("recomputes available actions when permissions arrive after the first render", () => {
        const actions = [{ name: "Ver", label: "Ver", handler: vi.fn() }];

        useUserInformation.mockReturnValue({ permissionsAdmin: [] });

        const { result, rerender } = renderHook(() =>
            usePermissionsUser({ moduleId: 26, actions, nameCreate: "Crear" }),
        );

        expect(result.current.arrayAction).toEqual([]);
        expect(result.current.canBeCreate).toBe(false);

        useUserInformation.mockReturnValue({
            permissionsAdmin: [
                { module_id: 26, name: "Ver", granted: true },
                { module_id: 26, name: "Crear", granted: true },
            ],
        });

        rerender();

        expect(result.current.arrayAction).toHaveLength(1);
        expect(result.current.arrayAction[0]).toMatchObject({ name: "Ver", permissionName: "Ver" });
        expect(result.current.canBeCreate).toBe(true);
    });

    it("handles inline action arrays without scheduling repeated state updates", () => {
        useUserInformation.mockReturnValue({
            permissionsAdmin: [{ module_id: 26, name: "Ver", granted: true }],
        });

        const { result, rerender } = renderHook(
            ({ handler }) =>
                usePermissionsUser({
                    moduleId: 26,
                    actions: [{ name: "Ver", label: "Ver", handler }],
                    nameCreate: "Crear",
                }),
            { initialProps: { handler: vi.fn() } },
        );

        const nextHandler = vi.fn();
        rerender({ handler: nextHandler });

        expect(result.current.arrayAction).toHaveLength(1);
        expect(result.current.arrayAction[0].action).toBe(nextHandler);
    });

    it("ordena por clave traducida o literal y deja las acciones custom al final", () => {
        useUserInformation.mockReturnValue({
            permissionsAdmin: [
                { module_id: 26, name: "Custom", granted: true },
                { module_id: 26, name: "Eliminar", granted: true },
                { module_id: 26, name: "Ver", granted: true },
                { module_id: 26, name: "Editar", granted: true },
            ],
        });

        const { result } = renderHook(() =>
            usePermissionsUser({
                moduleId: 26,
                nameCreate: "Crear",
                actions: [
                    { name: "Custom", label: "Registrar", handler: vi.fn() },
                    { name: "Eliminar", label: "Eliminar", handler: vi.fn() },
                    { name: "Ver", label: "View", handler: vi.fn() },
                    { name: "Editar", label: "Editar", handler: vi.fn() },
                ],
            }),
        );

        expect(result.current.arrayAction.map((action) => action.permissionName)).toEqual([
            "Ver",
            "Editar",
            "Eliminar",
            "Custom",
        ]);
    });
});
