import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import RunDetailsModal from "./RunDetailsModal";

const mockUseRunDetail = vi.fn();
const mockI18n = vi.hoisted(() => ({ resolvedLanguage: "es" }));

vi.mock("./useRunDetail", () => ({
    default: (...args) => mockUseRunDetail(...args),
}));
// Simula i18n real: una clave conocida traduce, las demás caen al defaultValue (código crudo).
const TRANSLATIONS = {
    "assignmentMonitor.skipReasons.no_valid_case_for_users": "Quedó cupo libre sin caso válido",
    "assignmentMonitor.detail.backlogComputedAgo": "calculado {{count}} min antes de la corrida",
    "assignmentMonitor.detail.backlogComputedAt": "Calculado el {{date}}",
};
vi.mock("react-i18next", () => ({
    useTranslation: () => ({
        t: (key, opts) =>
            String(TRANSLATIONS[key] ?? opts?.defaultValue ?? key).replace(
                /{{(\w+)}}/g,
                (_, name) => opts?.[name] ?? "",
            ),
        i18n: mockI18n,
    }),
}));

const runDetail = {
    id: "r1",
    status: "completed",
    started_at: "2026-07-21T14:20:00.000Z",
    duration_ms: 1500,
    actions_detail: {
        actions: [
            {
                id: "a1",
                description: "Asignar grupo en curso",
                action_type: "asignar_grupo_en_curso",
                candidates: 12,
                assigned: 3,
                skipped: 2,
                errors: 0,
                duration_ms: 800,
                skip_reasons: { no_valid_case_for_users: 2 },
            },
        ],
        not_applicable: [
            {
                id: "na1",
                description: "Asignacion por cron Roberto",
                action_type: "asignar_grupo_por_codigo_externo",
                reason: "automation_window_expired",
            },
        ],
        prefilter: null,
    },
    capacity_snapshot: {
        groups: [
            {
                grupo_id: "g1",
                nombre: "Soporte N1",
                users_total: 7,
                users_available: 2,
                users_with_capacity: 2,
                capacidad: 5,
                max_cases_per_user: 4,
                assigned: 3,
            },
            {
                grupo_id: "g2",
                users_total: 3,
                users_available: 2,
                users_with_capacity: 0,
                capacidad: 0,
                max_cases_per_user: 4,
                assigned: 0,
            },
            {
                grupo_id: "g3",
                users_total: null,
                users_available: null,
                users_with_capacity: null,
                capacidad: null,
                max_cases_per_user: null,
                assigned: 1,
                work_queue: false,
            },
        ],
    },
    error_detail: null,
};

describe("RunDetailsModal", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockI18n.resolvedLanguage = "es";
        mockUseRunDetail.mockReturnValue({ run: runDetail, isLoading: false, isError: false });
    });

    it("renders the evaluated actions with translated skip reasons", () => {
        render(<RunDetailsModal isOpen onClose={vi.fn()} runId="r1" />);
        expect(screen.getByText("Asignar grupo en curso")).toBeInTheDocument();
        // El motivo pasa por el diccionario i18n; un código sin traducción caería al crudo
        expect(screen.getByText(/Quedó cupo libre sin caso válido: 2/)).toBeInTheDocument();
    });

    it("renders discarded actions with their not-applicable reason", () => {
        render(<RunDetailsModal isOpen onClose={vi.fn()} runId="r1" />);
        const section = screen.getByTestId("not-applicable-section");
        expect(section).toHaveTextContent("Asignacion por cron Roberto");
        expect(section).toHaveTextContent("automation_window_expired");
    });

    it("omits the discarded-actions section when there are none", () => {
        mockUseRunDetail.mockReturnValue({
            run: { ...runDetail, actions_detail: { ...runDetail.actions_detail, not_applicable: [] } },
            isLoading: false,
            isError: false,
        });
        render(<RunDetailsModal isOpen onClose={vi.fn()} runId="r1" />);
        expect(screen.queryByTestId("not-applicable-section")).not.toBeInTheDocument();
    });

    it("shows the run date and time instead of the id in the subtitle", () => {
        render(<RunDetailsModal isOpen onClose={vi.fn()} runId="r1" />);
        const subtitle = screen.getByTestId("run-detail-date");
        expect(subtitle).toHaveTextContent(new Date("2026-07-21T14:20:00.000Z").toLocaleString("sv-SE"));
        expect(subtitle).not.toHaveTextContent("r1");
    });

    it("shows the group name and falls back to the id when missing", () => {
        render(<RunDetailsModal isOpen onClose={vi.fn()} runId="r1" />);
        fireEvent.mouseDown(screen.getByTestId("tab_capacity"));
        fireEvent.click(screen.getByTestId("tab_capacity"));
        expect(screen.getByText("Soporte N1")).toBeInTheDocument();
        expect(screen.queryByText("g1")).not.toBeInTheDocument();
        expect(screen.getByText("g2")).toBeInTheDocument();
    });

    it("shows the total group members even when none has capacity", () => {
        render(<RunDetailsModal isOpen onClose={vi.fn()} runId="r1" />);
        fireEvent.mouseDown(screen.getByTestId("tab_capacity"));
        fireEvent.click(screen.getByTestId("tab_capacity"));

        const g1Row = screen.getByText("Soporte N1").closest("tr");
        expect(within(g1Row).getByText("7")).toBeInTheDocument();

        // g2: 3 usuarios en el grupo aunque 0 con capacidad
        const g2Row = screen.getByText("g2").closest("tr");
        expect(within(g2Row).getByText("3")).toBeInTheDocument();

        // g3 (no work-queue): sin dato → "-"
        const g3Row = screen.getByText("g3").closest("tr");
        expect(within(g3Row).getAllByText("-").length).toBeGreaterThan(0);
    });

    it("shows how many available users have no remaining capacity", () => {
        render(<RunDetailsModal isOpen onClose={vi.fn()} runId="r1" />);
        fireEvent.mouseDown(screen.getByTestId("tab_capacity"));
        fireEvent.click(screen.getByTestId("tab_capacity"));

        // g1: 2 disponibles y 2 con cupo → 0 saturados
        expect(screen.getByTestId("available-no-capacity-g1")).toHaveTextContent("0");
        // g2: 2 disponibles pero 0 con cupo → 2 saturados
        expect(screen.getByTestId("available-no-capacity-g2")).toHaveTextContent("2");
        // g3: sin dato
        expect(screen.getByTestId("available-no-capacity-g3")).toHaveTextContent("-");
    });

    it("marks groups without capacity", () => {
        render(<RunDetailsModal isOpen onClose={vi.fn()} runId="r1" />);
        fireEvent.mouseDown(screen.getByTestId("tab_capacity"));
        fireEvent.click(screen.getByTestId("tab_capacity"));
        const flagged = screen.getAllByTestId("group-no-capacity");
        expect(flagged).toHaveLength(1);
        expect(flagged[0]).toHaveTextContent("g2");

        expect(screen.getByText("∞")).toBeInTheDocument();
        const g3Row = screen.getByText("g3").closest("tr");
        expect(within(g3Row).getAllByText("-").length).toBeGreaterThan(0);
    });

    it("returns null when closed", () => {
        const { container } = render(<RunDetailsModal isOpen={false} onClose={vi.fn()} runId="r1" />);
        expect(container.innerHTML).toBe("");
    });

    it("renders an error state when the run detail fails to load", () => {
        mockUseRunDetail.mockReturnValue({ run: null, isLoading: false, isError: true });
        render(<RunDetailsModal isOpen onClose={vi.fn()} runId="r1" />);
        expect(screen.getByTestId("run-detail-error")).toBeInTheDocument();
        expect(screen.queryByTestId("tab_actions")).not.toBeInTheDocument();
    });

    const withActions = (actions) => ({ ...runDetail, actions_detail: { ...runDetail.actions_detail, actions } });
    const baseAction = (override) => ({
        id: "b1",
        description: "Finalización Autos",
        action_type: "asignar_grupo_por_codigo_externo",
        candidates: 0,
        assigned: 0,
        skipped: 1,
        errors: 0,
        skip_reasons: {},
        ...override,
    });

    it("shows the pending column with thousands separator and its age relative to the run start", () => {
        mockUseRunDetail.mockReturnValue({
            run: withActions([
                baseAction({ candidates_backlog: 11224, backlog_computed_at: "2026-07-21T14:17:00.000Z" }),
            ]),
            isLoading: false,
            isError: false,
        });
        render(<RunDetailsModal isOpen onClose={() => {}} runId="r1" />);

        expect(screen.getByTestId("backlog-b1")).toHaveTextContent("11.224");
        expect(screen.getByTestId("backlog-age-b1")).toHaveTextContent("calculado 3 min antes de la corrida");
    });

    it.each([
        ["exactly 60 s", "2026-07-21T14:19:00.000Z"],
        ["1 min 50 s", "2026-07-21T14:18:10.000Z"],
    ])("counts only whole minutes in the age line (%s before the run)", (_label, computedAt) => {
        mockUseRunDetail.mockReturnValue({
            run: withActions([baseAction({ candidates_backlog: 7, backlog_computed_at: computedAt })]),
            isLoading: false,
            isError: false,
        });
        render(<RunDetailsModal isOpen onClose={() => {}} runId="r1" />);

        expect(screen.getByTestId("backlog-age-b1")).toHaveTextContent("calculado 1 min antes de la corrida");
    });

    it("formats the pending figure with the active UI language", () => {
        mockI18n.resolvedLanguage = "en";
        mockUseRunDetail.mockReturnValue({
            run: withActions([baseAction({ candidates_backlog: 11224, backlog_computed_at: null })]),
            isLoading: false,
            isError: false,
        });
        render(<RunDetailsModal isOpen onClose={() => {}} runId="r1" />);

        expect(screen.getByTestId("backlog-b1")).toHaveTextContent("11,224");
    });

    it("shows a live backlog without age line", () => {
        mockUseRunDetail.mockReturnValue({
            run: withActions([baseAction({ candidates_backlog: 12, backlog_computed_at: null })]),
            isLoading: false,
            isError: false,
        });
        render(<RunDetailsModal isOpen onClose={() => {}} runId="r1" />);

        expect(screen.getByTestId("backlog-b1")).toHaveTextContent("12");
        expect(screen.queryByTestId("backlog-age-b1")).toBeNull();
    });

    it("shows a legacy run backlog (pre-snapshot) without age line", () => {
        mockUseRunDetail.mockReturnValue({
            run: withActions([baseAction({ candidates_backlog: 11224 })]),
            isLoading: false,
            isError: false,
        });
        render(<RunDetailsModal isOpen onClose={() => {}} runId="r1" />);

        expect(screen.getByTestId("backlog-b1")).toHaveTextContent("11.224");
        expect(screen.queryByTestId("backlog-age-b1")).toBeNull();
    });

    it.each([
        ["computed after the run started", "2026-07-21T14:22:00.000Z"],
        ["computed less than a minute before the run", "2026-07-21T14:19:45.000Z"],
        ["computed 45 s before the run", "2026-07-21T14:19:15.000Z"],
    ])("hides the age line when the figure is fresh (%s)", (_label, computedAt) => {
        mockUseRunDetail.mockReturnValue({
            run: withActions([baseAction({ candidates_backlog: 7, backlog_computed_at: computedAt })]),
            isLoading: false,
            isError: false,
        });
        render(<RunDetailsModal isOpen onClose={() => {}} runId="r1" />);

        expect(screen.getByTestId("backlog-b1")).toHaveTextContent("7");
        expect(screen.queryByTestId("backlog-age-b1")).toBeNull();
    });

    it.each([
        [
            "null backlog with a timestamp",
            { candidates_backlog: null, backlog_computed_at: "2026-07-21T14:17:00.000Z" },
        ],
        ["missing fields", {}],
        ["invalid timestamp", { candidates_backlog: 5, backlog_computed_at: "not-a-date" }],
    ])("degrades cleanly for %s", (_label, override) => {
        mockUseRunDetail.mockReturnValue({
            run: withActions([baseAction(override)]),
            isLoading: false,
            isError: false,
        });
        render(<RunDetailsModal isOpen onClose={() => {}} runId="r1" />);

        const cell = screen.getByTestId("backlog-b1");
        expect(cell).not.toHaveTextContent("NaN");
        expect(screen.queryByTestId("backlog-age-b1")).toBeNull();
        if (typeof override.candidates_backlog !== "number") expect(cell).toHaveTextContent("—");
    });
});
