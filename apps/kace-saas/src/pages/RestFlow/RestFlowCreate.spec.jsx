import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import useRestFlowCreate from "./hooks/useRestFlowCreate"
import { RestFlowsCreate } from "./RestFlowCreate"

vi.mock("../../components/core/Cards/DashboardSectionCard", () => ({
    DashboardSectionCard: vi.fn(({ children }) => (
        <div data-testid="dashboard-section-card">
            {children}
        </div>
    )),
}))

vi.mock("./components/RestFlowsForm", () => ({
    default: vi.fn(({ dataHandler, data, isSending }) => (
        <div data-testid="rest-flows-form"
             data-is-sending={isSending}
             data-has-data={!!data}
        >
            Mocked RestFlowsForm
            <button onClick={dataHandler}>Submit Form</button>
        </div>
    )),
}))

vi.mock("./hooks/useRestFlowCreate", () => ({
    default: vi.fn(() => ({
        handleRestFlow: vi.fn(),
        restFlows: null,
        isPending: false,
        isLoading: false,
    })),
}))


describe("RestFlowsCreate", () => {
    beforeEach(() => {
        vi.clearAllMocks()
        useRestFlowCreate.mockReturnValue({
            handleRestFlow: vi.fn(),
            restFlows: null,
            isPending: false,
            isLoading: false,
        })
    })

    it("renders the DashboardSectionCard component", () => {
        render(<RestFlowsCreate />)
        expect(screen.getByTestId("dashboard-section-card")).toBeInTheDocument()
    })

    it("renders the RestFlowsForm component", () => {
        render(<RestFlowsCreate />)
        expect(screen.getByTestId("rest-flows-form")).toBeInTheDocument()
    })

    it("passes the handleRestFlow function as dataHandler to RestFlowsForm", () => {
        const mockHandleRestFlow = vi.fn()
        useRestFlowCreate.mockReturnValue({
            handleRestFlow: mockHandleRestFlow,
            restFlows: null,
            isPending: false,
            isLoading: false,
        })

        render(<RestFlowsCreate />)

        screen.getByText("Submit Form").click()
        expect(mockHandleRestFlow).toHaveBeenCalledTimes(1)
    })

    it("passes restFlows data to RestFlowsForm", () => {
        const mockRestFlowsData = { id: 1, name: "Test Flow" }
        useRestFlowCreate.mockReturnValue({
            handleRestFlow: vi.fn(),
            restFlows: mockRestFlowsData,
            isPending: false,
            isLoading: false,
        })

        render(<RestFlowsCreate />)
        const restFlowsForm = screen.getByTestId("rest-flows-form")

        expect(restFlowsForm).toHaveAttribute("data-has-data", "true")
    })

    it("passes isPending as true to isSending prop when isPending is true", () => {
        useRestFlowCreate.mockReturnValue({
            handleRestFlow: vi.fn(),
            restFlows: null,
            isPending: true,
            isLoading: false,
        })

        render(<RestFlowsCreate />)
        expect(screen.getByTestId("rest-flows-form")).toHaveAttribute("data-is-sending", "true")
    })

    it("passes isLoading as true to isSending prop when isLoading is true", () => {
        useRestFlowCreate.mockReturnValue({
            handleRestFlow: vi.fn(),
            restFlows: null,
            isPending: false,
            isLoading: true,
        })

        render(<RestFlowsCreate />)
        expect(screen.getByTestId("rest-flows-form")).toHaveAttribute("data-is-sending", "true")
    })

    it("passes isSending as false when both isPending and isLoading are false", () => {
        useRestFlowCreate.mockReturnValue({
            handleRestFlow: vi.fn(),
            restFlows: null,
            isPending: false,
            isLoading: false,
        })

        render(<RestFlowsCreate />)
        expect(screen.getByTestId("rest-flows-form")).toHaveAttribute("data-is-sending", "false")
    })

    it("passes isSending as true when both isPending and isLoading are true", () => {
        useRestFlowCreate.mockReturnValue({
            handleRestFlow: vi.fn(),
            restFlows: null,
            isPending: true,
            isLoading: true,
        })

        render(<RestFlowsCreate />)
        expect(screen.getByTestId("rest-flows-form")).toHaveAttribute("data-is-sending", "true")
    })
})