import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import { useSelector } from "react-redux"
import { CasesHandler } from "./CasesHandler"
vi.mock("react-redux", async (importOriginal) => {
    const actual = await importOriginal()
    return {
        ...actual,
        useSelector: vi.fn(),
    }
})

vi.mock("../../components/core/Cards/DashboardSectionCard", () => ({
    DashboardSectionCard: vi.fn(({ title, children }) => (
        <div data-testid="mock-dashboard-card" data-title={title}>
            {children}
        </div>
    )),
}))

vi.mock("../../components/core/DefaultIndexActions/DefaultIndexActions", () => ({
    default: vi.fn(({ children }) => (
        <div data-testid="mock-default-index-actions">{children}</div>
    )),
}))

vi.mock("./hooks/useCasesActions", () => ({
    default: vi.fn(() => ({
        arrayActions: [{ name: "Action 1" }],
        type: "defaultType",
        description: "defaultDescription",
    })),
}))

vi.mock("../../components/core/CasesTableComponent/CasesTableComponent", () => ({
    CasesTableComponent: vi.fn(({ actionProps, keyQuery, showFilterCases }) => (
        <div data-testid="mock-cases-table" data-action-props={JSON.stringify(actionProps)} data-key-query={keyQuery} data-show-filter-cases={showFilterCases}>
            Mock Cases Table
        </div>
    )),
})
)

vi.mock("./components/ModalActions/ConfigurableModal", () => ({
    ConfigurableModal: vi.fn(({ type, description }) => (
        <div data-testid="mock-configurable-modal" data-type={type} data-description={description}>
            Mock Configurable Modal
        </div>
    )),
}))

vi.mock("../../utils/urlAndKeys", () => ({
    URL_AND_KEYS: {
        cases: {
            key: "mockCasesKey",
        },
    },
}))

describe("CasesHandler", () => {
    it("renders with the correct title from Redux state", () => {
        useSelector.mockReturnValue("My Cases Dashboard")

        render(<CasesHandler />)

        expect(screen.getByTestId("mock-dashboard-card")).toHaveAttribute(
            "data-title",
            "My Cases Dashboard"
        )
    })

    it("passes correct props to DefaultIndexActions and ConfigurableModal", () => {
        useSelector.mockReturnValue("Test Title")

        render(<CasesHandler />)

        expect(screen.getByTestId("mock-configurable-modal")).toHaveAttribute(
            "data-type",
            "defaultType"
        )
        expect(screen.getByTestId("mock-configurable-modal")).toHaveAttribute(
            "data-description",
            "defaultDescription"
        )
    })

    it("passes correct props to CasesTableComponent", () => {
        useSelector.mockReturnValue("Test Title")

        render(<CasesHandler />)

        expect(screen.getByTestId("mock-cases-table")).toHaveAttribute(
            "data-action-props",
            JSON.stringify([{ name: "Action 1" }])
        )
        expect(screen.getByTestId("mock-cases-table")).toHaveAttribute(
            "data-key-query",
            "mockCasesKey"
        )
        expect(screen.getByTestId("mock-cases-table")).toHaveAttribute(
            "data-show-filter-cases",
            "true"
        )
    })
})