import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
    GeneralLoader,
} from "@kace/ui-shared";
import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import useRunDetail from "./useRunDetail";
import CapacityTable from "./CapacityTable";

const formatSkipReasons = (skipReasons, t) =>
    Object.entries(skipReasons ?? {})
        .map(([reason, count]) => `${t(`assignmentMonitor.skipReasons.${reason}`, { defaultValue: reason })}: ${count}`)
        .join(", ");

const formatDateTime = (raw) => {
    if (!raw) return "";
    const date = new Date(raw);
    return isNaN(date) ? "" : date.toLocaleString("sv-SE");
};

const formatBacklog = (value, locale) => (typeof value === "number" ? value.toLocaleString(locale) : "—");

// Medida contra el inicio de la corrida, no contra "ahora": una corrida de ayer no debe decir "hace 1 día".
// Menos de 1 min (o calculada después del inicio) cuenta como fresca y no se muestra.
const minutesBeforeRun = (computedAt, startedAt) => {
    if (!computedAt || !startedAt) return null;
    const minutes = Math.floor((new Date(startedAt) - new Date(computedAt)) / 60000);
    return Number.isFinite(minutes) && minutes >= 1 ? minutes : null;
};

const BacklogCell = ({ action, startedAt, locale, t }) => {
    const minutes =
        typeof action.candidates_backlog === "number" ? minutesBeforeRun(action.backlog_computed_at, startedAt) : null;

    return (
        <td className="p-2" data-testid={`backlog-${action.id}`}>
            {formatBacklog(action.candidates_backlog, locale)}
            {minutes !== null && (
                <div
                    className="text-xs text-gray-500"
                    data-testid={`backlog-age-${action.id}`}
                    title={t("assignmentMonitor.detail.backlogComputedAt", {
                        date: formatDateTime(action.backlog_computed_at),
                    })}
                >
                    {t("assignmentMonitor.detail.backlogComputedAgo", { count: minutes })}
                </div>
            )}
        </td>
    );
};

BacklogCell.propTypes = {
    action: PropTypes.shape({
        id: PropTypes.string,
        candidates_backlog: PropTypes.number,
        backlog_computed_at: PropTypes.string,
    }).isRequired,
    startedAt: PropTypes.string,
    locale: PropTypes.string,
    t: PropTypes.func.isRequired,
};

const RunDetailsModal = ({ isOpen, onClose, runId }) => {
    const { t, i18n } = useTranslation();
    const { run, isLoading, isError } = useRunDetail(isOpen ? runId : null);

    if (!isOpen) return null;

    const actions = run?.actions_detail?.actions ?? [];
    const notApplicable = run?.actions_detail?.not_applicable ?? [];
    const groups = run?.capacity_snapshot?.groups ?? [];

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="w-[95vw] max-w-[95vw] h-[90vh] max-h-[90vh] overflow-auto content-start">
                <DialogHeader>
                    <DialogTitle>{t("assignmentMonitor.detail.title")}</DialogTitle>
                    <DialogDescription data-testid="run-detail-date">
                        {formatDateTime(run?.started_at)}
                    </DialogDescription>
                </DialogHeader>
                {isLoading ? (
                    <GeneralLoader />
                ) : isError ? (
                    <p className="text-red-700" data-testid="run-detail-error">
                        {t("assignmentMonitor.detail.loadError", { defaultValue: "No fue posible cargar el detalle" })}
                    </p>
                ) : (
                    <Tabs defaultValue="actions" className="w-full">
                        <TabsList>
                            <TabsTrigger value="actions" data-testid="tab_actions">
                                {t("assignmentMonitor.detail.actionsTab")}
                            </TabsTrigger>
                            <TabsTrigger value="capacity" data-testid="tab_capacity">
                                {t("assignmentMonitor.detail.capacityTab")}
                            </TabsTrigger>
                        </TabsList>
                        <TabsContent value="actions">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left border-b">
                                            <th className="p-2">{t("assignmentMonitor.detail.action")}</th>
                                            <th className="p-2">{t("assignmentMonitor.detail.type")}</th>
                                            <th className="p-2" title={t("assignmentMonitor.tooltips.candidates")}>
                                                {t("assignmentMonitor.columns.candidates")}
                                            </th>
                                            <th className="p-2" title={t("assignmentMonitor.tooltips.actionBacklog")}>
                                                {t("assignmentMonitor.detail.backlog")}
                                            </th>
                                            <th className="p-2" title={t("assignmentMonitor.tooltips.assigned")}>
                                                {t("assignmentMonitor.columns.assigned")}
                                            </th>
                                            <th className="p-2" title={t("assignmentMonitor.tooltips.skipped")}>
                                                {t("assignmentMonitor.columns.skipped")}
                                            </th>
                                            <th className="p-2" title={t("assignmentMonitor.tooltips.errors")}>
                                                {t("assignmentMonitor.columns.errors")}
                                            </th>
                                            <th className="p-2" title={t("assignmentMonitor.tooltips.skipped")}>
                                                {t("assignmentMonitor.detail.skipReasons")}
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {actions.map((action) => (
                                            <tr key={action.id} className="border-b">
                                                <td className="p-2">{action.description}</td>
                                                <td className="p-2">{action.action_type}</td>
                                                <td className="p-2">{action.candidates}</td>
                                                <BacklogCell
                                                    action={action}
                                                    startedAt={run?.started_at}
                                                    locale={i18n?.resolvedLanguage}
                                                    t={t}
                                                />
                                                <td className="p-2">{action.assigned}</td>
                                                <td className="p-2">{action.skipped}</td>
                                                <td className="p-2">{action.errors}</td>
                                                <td className="p-2">{formatSkipReasons(action.skip_reasons, t)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {notApplicable.length > 0 && (
                                <div className="mt-4 overflow-x-auto" data-testid="not-applicable-section">
                                    <h3 className="font-semibold">
                                        {t("assignmentMonitor.detail.notApplicableTitle")}
                                    </h3>
                                    <table className="w-full text-sm">
                                        <thead>
                                            <tr className="text-left border-b">
                                                <th className="p-2">{t("assignmentMonitor.detail.action")}</th>
                                                <th className="p-2">{t("assignmentMonitor.detail.type")}</th>
                                                <th className="p-2">
                                                    {t("assignmentMonitor.detail.notApplicableReason")}
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {notApplicable.map((action) => (
                                                <tr key={action.id} className="border-b">
                                                    <td className="p-2">{action.description ?? action.id}</td>
                                                    <td className="p-2">{action.action_type}</td>
                                                    <td className="p-2">
                                                        {t(`assignmentMonitor.notApplicableReasons.${action.reason}`, {
                                                            defaultValue: action.reason,
                                                        })}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </TabsContent>
                        <TabsContent value="capacity">
                            <CapacityTable groups={groups} />
                        </TabsContent>
                    </Tabs>
                )}
                {run?.error_detail && (
                    <div className="mt-2">
                        <h3 className="font-semibold text-red-700">{t("assignmentMonitor.detail.errorDetail")}</h3>
                        <pre className="text-xs text-gray-700 overflow-auto max-h-40">{run.error_detail.message}</pre>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
};

RunDetailsModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    runId: PropTypes.string,
};

export default RunDetailsModal;
