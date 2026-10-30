import { Button } from "@kace/ui-shared";

const SLOW_RUN_MS = 60000;

const STATUS_COLORS = {
    completed: { bg: "#E6F4F1", text: "#0F766E" },
    no_actions: { bg: "#EEF2FF", text: "#3730A3" },
    no_eligible_actions: { bg: "#F0F9FF", text: "#0369A1" },
    already_running: { bg: "#FFF4E5", text: "#B54708" },
    error: { bg: "#FDE8E4", text: "#B42318" },
    // Fallback neutro para estados futuros/desconocidos: no deben verse como errores.
    unknown: { bg: "#F3F4F6", text: "#374151" },
};

const formatDate = (raw) => {
    if (!raw) return "";
    const date = new Date(raw);
    return isNaN(date) ? raw : date.toLocaleString("sv-SE");
};

// El header explica con un tooltip nativo qué cuenta exactamente la métrica.
const withTooltip = (t, labelKey, tooltipKey) => <span title={t(tooltipKey)}>{t(labelKey)}</span>;

const formatDuration = (ms) => {
    if (ms === null || ms === undefined) return "";
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
};

export const buildRunColumns = (t, onOpenDetail) => [
    {
        accessorKey: "started_at",
        header: t("assignmentMonitor.columns.startedAt"),
        cell: ({ row }) => formatDate(row.original.started_at),
        isVisible: true,
    },
    {
        accessorKey: "duration_ms",
        header: t("assignmentMonitor.columns.duration"),
        cell: ({ row }) => {
            const ms = row.original.duration_ms;
            const slow = ms >= SLOW_RUN_MS;
            return (
                <span className={slow ? "font-semibold text-red-600" : ""} data-testid={slow ? "slow-run" : undefined}>
                    {formatDuration(ms)}
                </span>
            );
        },
        isVisible: true,
    },
    {
        accessorKey: "status",
        header: t("assignmentMonitor.columns.status"),
        cell: ({ row }) => {
            const status = row.original.status;
            const colors = STATUS_COLORS[status] ?? STATUS_COLORS.unknown;
            return (
                <p
                    className="py-1 px-2 rounded-full text-center"
                    style={{ backgroundColor: colors.bg, color: colors.text }}
                >
                    {t(`assignmentMonitor.statuses.${status}`, { defaultValue: status })}
                </p>
            );
        },
        isVisible: true,
    },
    {
        accessorKey: "actions_evaluated",
        header: withTooltip(t, "assignmentMonitor.columns.actions", "assignmentMonitor.tooltips.actions"),
        isVisible: true,
    },
    {
        accessorKey: "candidates_total",
        header: withTooltip(t, "assignmentMonitor.columns.candidates", "assignmentMonitor.tooltips.candidates"),
        isVisible: true,
    },
    {
        accessorKey: "candidates_backlog_total",
        header: withTooltip(t, "assignmentMonitor.columns.backlog", "assignmentMonitor.tooltips.backlog"),
        cell: ({ row }) => {
            const value = row.original.candidates_backlog_total;
            return value ?? "—";
        },
        isVisible: true,
    },
    {
        accessorKey: "assigned",
        header: withTooltip(t, "assignmentMonitor.columns.assigned", "assignmentMonitor.tooltips.assigned"),
        isVisible: true,
    },
    {
        accessorKey: "skipped",
        header: withTooltip(t, "assignmentMonitor.columns.skipped", "assignmentMonitor.tooltips.skipped"),
        isVisible: true,
    },
    {
        accessorKey: "errors",
        header: withTooltip(t, "assignmentMonitor.columns.errors", "assignmentMonitor.tooltips.errors"),
        isVisible: true,
    },
    {
        accessorKey: "groups_without_capacity",
        header: withTooltip(
            t,
            "assignmentMonitor.columns.groupsWithoutCapacity",
            "assignmentMonitor.tooltips.groupsWithoutCapacity",
        ),
        cell: ({ row }) => {
            const value = row.original.groups_without_capacity ?? 0;
            if (value === 0) return <span>0</span>;
            return (
                <p
                    className="py-1 px-2 rounded-full text-center"
                    style={{ backgroundColor: "#FDE8E4", color: "#B42318" }}
                    data-testid="no-capacity-badge"
                >
                    {value}
                </p>
            );
        },
        isVisible: true,
    },
    {
        // id "actions" (sin accessorKey): DataTableContainer solo invoca el cell custom de
        // columnas sin valor cuando id es "actions"/"select"; con otro id renderiza "Sin datos".
        id: "actions",
        header: t("assignmentMonitor.columns.detail"),
        cell: ({ row }) => (
            <Button
                variant="outline"
                size="sm"
                data-testid={`btn_run_detail_${row.original.id}`}
                onClick={() => onOpenDetail(row.original)}
            >
                {t("assignmentMonitor.columns.detail")}
            </Button>
        ),
    },
];
