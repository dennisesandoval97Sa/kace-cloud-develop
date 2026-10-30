import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAccessRoutes } from "./useAccessRoutes";
import { routes } from "@/routes/routes";

const mocks = vi.hoisted(() => ({
    useUserInformation: vi.fn(),
    useConfigAgentData: vi.fn(),
}));

vi.mock("./useUserInformation", () => ({
    default: mocks.useUserInformation,
}));

vi.mock("./useConfigAgentData", () => ({
    default: mocks.useConfigAgentData,
}));

describe("useAccessRoutes", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mocks.useConfigAgentData.mockReturnValue({ hidden_menus: [] });
    });

    it("shows Channel Hub as a top-level route to users with ChannelHubRead", () => {
        mocks.useUserInformation.mockReturnValue({
            permissionsAdmin: [
                {
                    name: "ChannelHubRead",
                    module_id: "channel-hub",
                    granted: true,
                },
            ],
        });

        const { result } = renderHook(() => useAccessRoutes());

        const topLevelChannelHubRoute = result.current.accessRoutes.find((route) => route.to === "/channel-hub");
        const nestedChannelHubRoute = result.current.accessRoutes.find((route) =>
            route.items?.some((item) => item.to === "/channel-hub"),
        );

        expect(topLevelChannelHubRoute).toBeDefined();
        expect(nestedChannelHubRoute).toBeUndefined();
    });

    it("shows Boards as a top-level route to users with BoardsRead", () => {
        // Los tableros salieron del submenu lateral y pasaron a ser un listado propio.
        mocks.useUserInformation.mockReturnValue({
            permissionsAdmin: [
                {
                    name: "BoardsRead",
                    module_id: "boards",
                    granted: true,
                },
            ],
        });

        const { result } = renderHook(() => useAccessRoutes());

        expect(result.current.accessRoutes.some((route) => route.to === "/boards")).toBe(true);
    });

    it("hides Boards when hidden_menus still has the legacy parent name or create child", () => {
        mocks.useUserInformation.mockReturnValue({
            permissionsAdmin: [{ name: "BoardsRead", module_id: "boards", granted: true }],
        });
        const boardsName = routes.find((route) => route.to === "/boards")?.name;
        mocks.useConfigAgentData.mockReturnValue({ hidden_menus: [boardsName] });

        const { result, rerender } = renderHook(() => useAccessRoutes());
        expect(result.current.accessRoutes.some((route) => route.to === "/boards")).toBe(false);

        mocks.useConfigAgentData.mockReturnValue({ hidden_menus: ["/boards/create"] });
        rerender();
        expect(result.current.accessRoutes.some((route) => route.to === "/boards")).toBe(false);
    });

    it("does not show Boards when BoardsRead is granted only to the agent role", () => {
        /*
         * accessRoutes solo mira el stack de administrador, igual que el backend en
         * actionSearch: un agente con BoardsRead no debe ver la entrada.
         */
        mocks.useUserInformation.mockReturnValue({ permissionsAdmin: [] });

        const { result } = renderHook(() => useAccessRoutes());

        expect(result.current.accessRoutes.some((route) => route.to === "/boards")).toBe(false);
    });

    it("does not show Channel Hub when ChannelHubRead is missing", () => {
        mocks.useUserInformation.mockReturnValue({
            permissionsAdmin: [
                {
                    name: "ChannelHubUpdate",
                    module_id: "channel-hub",
                    granted: true,
                },
            ],
        });

        const { result } = renderHook(() => useAccessRoutes());

        expect(result.current.accessRoutes.some((route) => route.to === "/channel-hub")).toBe(false);
    });

    describe("Brokers menu", () => {
        const brokerItems = (accessRoutes) =>
            accessRoutes
                .find((route) => route.items?.some((item) => item.to?.startsWith("/broker/")))
                ?.items.map((item) => item.to) ?? [];

        it("shows Adapters to users with BrokerAdaptersRead", () => {
            mocks.useUserInformation.mockReturnValue({
                permissionsAdmin: [{ name: "BrokerAdaptersRead", module_id: "broker_adapters", granted: true }],
            });

            const { result } = renderHook(() => useAccessRoutes());

            expect(brokerItems(result.current.accessRoutes)).toEqual(["/broker/adapters"]);
        });

        it("shows Mappers to users with BrokerMappersRead", () => {
            mocks.useUserInformation.mockReturnValue({
                permissionsAdmin: [{ name: "BrokerMappersRead", module_id: "broker_mappers", granted: true }],
            });

            const { result } = renderHook(() => useAccessRoutes());

            expect(brokerItems(result.current.accessRoutes)).toEqual(["/broker/mappers"]);
        });

        it("hides the Brokers menu from users with only WsRestEndpointsRead", () => {
            mocks.useUserInformation.mockReturnValue({
                permissionsAdmin: [{ name: "WsRestEndpointsRead", module_id: "ws-rest-endpoints", granted: true }],
            });

            const { result } = renderHook(() => useAccessRoutes());

            expect(brokerItems(result.current.accessRoutes)).toEqual([]);
        });
    });
});
