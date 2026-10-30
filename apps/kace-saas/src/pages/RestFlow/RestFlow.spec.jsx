import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import RestFlow from "./RestFlow"
import useRestFlowsActions from "./hooks/useRestFlowsActions"
import usePermissionsUser from "../../hooks/usePermissionsUser"
import { useTranslation } from "react-i18next"

vi.mock("../../components/core/Cards/DashboardSectionCard", () => ({
    DashboardSectionCard: vi.fn(({ title, children }) => (
        <div data-testid="dashboard-section-card" title={title}>
            {children}
        </div>
    )),
}))

vi.mock("../../components/core/DefaultIndexActions/DefaultIndexActions", () => ({
    default: vi.fn(({ createUrl }) => (
        <div data-testid="default-index-actions" data-create-url={createUrl}>
            Mocked DefaultIndexActions
        </div>
    )),
}))

vi.mock("./components/RestFlowTableContainer", () => ({
    RestFlowsTableContainer: vi.fn(({ arrayAction }) => (
        <div data-testid="rest-flows-table-container">
            Mocked RestFlowsTableContainer with actions: {JSON.stringify(arrayAction.map(a => a.name))}
        </div>
    )),
}))

vi.mock("./hooks/useRestFlowsActions", () => ({
    default: vi.fn(() => ({
        handleUpdateRestFlow: vi.fn(),
        handleDeleteRestFlow: vi.fn(),
        handleSeeRestFlow: vi.fn(),
    })),
}))

vi.mock("../../hooks/usePermissionsUser", () => ({
    default: vi.fn(() => ({
        arrayAction: [],
        canBeCreate: false,
    })),
}))

vi.mock("react-i18next", () => ({
    useTranslation: vi.fn(() => ({
        t: vi.fn((key) => {
            switch (key) {
                case "app.forms.delete":
                    return "Eliminar"
                case "app.forms.see":
                    return "Ver"
                case "app.title.restFlows":
                    return "Flujos REST"
                default:
                    return key
            }
        }),
    })),
}))

describe("RestFlow", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useRestFlowsActions.mockReturnValue({
            handleUpdateRestFlow: vi.fn(),
            handleDeleteRestFlow: vi.fn(),
            handleSeeRestFlow: vi.fn(),
        })
        usePermissionsUser.mockReturnValue({
            arrayAction: [],
            canBeCreate: false,
        })
        useTranslation.mockReturnValue({
            t: vi.fn((key) => {
                switch (key) {
                    case "app.forms.delete":
                        return "Eliminar"
                    case "app.forms.see":
                        return "Ver"
                    case "app.title.restFlows":
                        return "Flujos REST"
                    default:
                        return key
                }
            }),
        })
    })

    it("renders the DashboardSectionCard with the correct title", () => {
        render(<RestFlow />)
        expect(screen.getByTestId("dashboard-section-card")).toHaveAttribute("title", "Flujos REST")
    })

    it("does not render DefaultIndexActions when canBeCreate is false", () => {
        usePermissionsUser.mockReturnValue({ arrayAction: [], canBeCreate: false })
        render(<RestFlow />)
        expect(screen.queryByTestId("default-index-actions")).toBeNull()
    })

    it("renders DefaultIndexActions with correct createUrl when canBeCreate is true", () => {
        usePermissionsUser.mockReturnValue({ arrayAction: [], canBeCreate: true })
        render(<RestFlow />)
        const defaultIndexActions = screen.getByTestId("default-index-actions")
        expect(defaultIndexActions).toBeInTheDocument()
        expect(defaultIndexActions).toHaveAttribute("data-create-url", "/rest-flows/create")
    })

    it("renders RestFlowsTableContainer with correct actions from usePermissionsUser", () => {
        const mockHandleUpdate = vi.fn()
        const mockHandleDelete = vi.fn()
        const mockHandleSee = vi.fn()

        useRestFlowsActions.mockReturnValue({
            handleUpdateRestFlow: mockHandleUpdate,
            handleDeleteRestFlow: mockHandleDelete,
            handleSeeRestFlow: mockHandleSee,
        })

        usePermissionsUser.mockReturnValue({
            canBeCreate: false,
            arrayAction: [
                { name: "WsRestFlowsUpdate", label: "Editar", handler: mockHandleUpdate },
                { name: "WsRestFlowsDelete", label: "Eliminar", handler: mockHandleDelete },
                { name: "WsRestFlowsRead", label: "Ver", handler: mockHandleSee },
            ],
        })

        render(<RestFlow />)

        const tableContainer = screen.getByTestId("rest-flows-table-container")
        expect(tableContainer).toBeInTheDocument()

        expect(tableContainer).toHaveTextContent(
            'Mocked RestFlowsTableContainer with actions: ["WsRestFlowsUpdate","WsRestFlowsDelete","WsRestFlowsRead"]'
        )
    })

    it("calls usePermissionsUser with the correct moduleId and actions", () => {
        const mockHandleUpdate = vi.fn()
        const mockHandleDelete = vi.fn()
        const mockHandleSee = vi.fn()

        useRestFlowsActions.mockReturnValue({
            handleUpdateRestFlow: mockHandleUpdate,
            handleDeleteRestFlow: mockHandleDelete,
            handleSeeRestFlow: mockHandleSee,
        })

        render(<RestFlow />)

        expect(usePermissionsUser).toHaveBeenCalledWith({
            moduleId: "ws-rest-flows",
            actions: [
                { name: "WsRestFlowsUpdate", label: "Editar", handler: mockHandleUpdate },
                { name: "WsRestFlowsDelete", label: "Eliminar", handler: mockHandleDelete },
                { name: "WsRestFlowsRead", label: "Ver", handler: mockHandleSee },
            ],
            nameCreate: "WsRestFlowsCreate",
        })
    })

    it("uses useTranslation for labels", () => {
        render(<RestFlow />)
        const tMock = useTranslation().t

        expect(tMock).toHaveBeenCalledWith("app.title.restFlows")
        expect(tMock).toHaveBeenCalledWith("app.forms.delete")
        expect(tMock).toHaveBeenCalledWith("app.forms.see")
    })
})