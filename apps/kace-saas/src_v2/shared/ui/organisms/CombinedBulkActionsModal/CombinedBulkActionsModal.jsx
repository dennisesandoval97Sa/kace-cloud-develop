import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dialog, Portal } from "@radix-ui/react-dialog";
import { Check, AlertTriangle, X as XIcon } from "lucide-react";
import DialogOverlay from "@kace_v2/shared/ui/atoms/DialogOverlay";
import DialogContent from "@kace_v2/shared/ui/atoms/DialogContent";
import DialogClose from "@kace_v2/shared/ui/atoms/DialogClose";
import DialogTitle from "@kace_v2/shared/ui/atoms/DialogTitle";
import ButtonV2 from "@kace_v2/shared/ui/atoms/Button";
import Checkbox from "@kace_v2/shared/ui/atoms/Checkbox";
import { cn } from "@kace_v2/shared/utils/cn.util";
import { getTranslatedError } from "@/utils/getTranslatedError";

const StepStatusIcon = ({ status }) => {
    if (status === "success") return <Check className="h-4 w-4 shrink-0 text-green-600" />;
    if (status === "partial") return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />;
    if (status === "error") return <XIcon className="h-4 w-4 shrink-0 text-red-600" />;
    return null;
};

const SectionResultMessage = ({ result, t }) => {
    if (!result || result.status === "skipped") return null;

    if (result.status === "error") {
        return (
            <p className="flex items-center gap-2 text-sm text-red-600">
                <StepStatusIcon status={result.status} />
                {getTranslatedError(result.error, t)}
            </p>
        );
    }

    const key = result.status === "partial" ? "combinedBulkActions.step.partial" : "combinedBulkActions.step.success";
    return (
        <p
            className={cn(
                "flex items-center gap-2 text-sm",
                result.status === "partial" ? "text-amber-600" : "text-green-600",
            )}
        >
            <StepStatusIcon status={result.status} />
            {t(key, { processed: result.processed, total: result.total })}
        </p>
    );
};

/**
 * Shell presentacional del modal combinado de acciones masivas.
 * No conoce Formik ni servicios: cada `section.content` ya viene renderizado
 * por el módulo (Cases/Boards) con sus propios campos y disparo de mutación.
 */
const CombinedBulkActionsModal = ({
    open,
    onOpenChange,
    sections,
    selectedCount,
    isRunning,
    hasAnyFailure,
    hasRunAny,
    onConfirm,
    onRequestClose,
}) => {
    const { t } = useTranslation();

    const hasRunnableSection = sections.some((section) => section.enabled && !section.disabledReason);
    const hasInvalidEnabledSection = sections.some(
        (section) => section.enabled && !section.disabledReason && section.isInvalid,
    );
    const canConfirm = !isRunning && !hasRunAny && hasRunnableSection && !hasInvalidEnabledSection;
    // Siempre exige un cierre explícito tras ejecutar: así el usuario alcanza a leer el
    // resultado por sección (éxito/error/omitida) antes de que el modal desaparezca,
    // en vez de auto-cerrarse de inmediato cuando todo salió bien.
    const mustConfirmExplicitClose = hasRunAny;

    const handleOpenChange = (nextOpen) => {
        if (!nextOpen && isRunning) return;
        onOpenChange(nextOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <Portal>
                <DialogOverlay />
                <DialogContent className={cn("sm:max-w-lg flex flex-col gap-4 max-h-[90vh] overflow-auto")}>
                    <DialogClose asChild>
                        <ButtonV2 size="icon" variant="outline" type="button" disabled={isRunning}>
                            <XIcon className="h-4 w-4" />
                        </ButtonV2>
                    </DialogClose>
                    <DialogTitle>{t("combinedBulkActions.title")}</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                        {t("combinedBulkActions.description", { count: selectedCount ?? 0 })}
                    </p>

                    {sections.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("combinedBulkActions.noSectionsAvailable")}</p>
                    ) : (
                        <div className="flex flex-col gap-4">
                            {hasRunAny && (
                                <p className="text-sm font-medium">{t("combinedBulkActions.summaryTitle")}</p>
                            )}
                            {sections.map((section) =>
                                section.onToggleEnabled ? (
                                    <div
                                        key={section.key}
                                        className="rounded-md border p-3"
                                        data-testid={`bulk-section-${section.key}`}
                                        data-invalid={section.isInvalid ? "true" : "false"}
                                        aria-invalid={section.isInvalid || undefined}
                                    >
                                        <label className="flex items-center gap-2 font-medium">
                                            <Checkbox
                                                checked={section.enabled}
                                                disabled={isRunning || hasRunAny}
                                                onCheckedChange={(checked) => section.onToggleEnabled(checked === true)}
                                            />
                                            {section.label}
                                        </label>
                                        {section.enabled && <div className="mt-3">{section.content}</div>}
                                        <SectionResultMessage result={section.result} t={t} />
                                    </div>
                                ) : (
                                    <div
                                        key={section.key}
                                        className="rounded-md border p-3"
                                        data-testid={`bulk-section-${section.key}`}
                                        data-invalid={section.isInvalid ? "true" : "false"}
                                        aria-invalid={section.isInvalid || undefined}
                                    >
                                        <p className="font-medium">{section.label}</p>
                                        {section.disabledReason ? (
                                            <p className="mt-2 flex items-center gap-2 text-sm text-amber-600">
                                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                                {section.disabledReason}
                                            </p>
                                        ) : (
                                            <div className="mt-3">{section.content}</div>
                                        )}
                                        <SectionResultMessage result={section.result} t={t} />
                                    </div>
                                ),
                            )}
                        </div>
                    )}

                    {hasInvalidEnabledSection && (
                        <p role="alert" className="text-sm text-red-600">
                            {t("combinedBulkActions.fixInvalidSections")}
                        </p>
                    )}

                    <div className="flex justify-end gap-2">
                        {mustConfirmExplicitClose ? (
                            <ButtonV2 type="button" onClick={onRequestClose}>
                                {t("combinedBulkActions.buttons.close")}
                            </ButtonV2>
                        ) : (
                            <>
                                <ButtonV2
                                    type="button"
                                    variant="outline"
                                    disabled={isRunning}
                                    onClick={() => handleOpenChange(false)}
                                >
                                    {t("combinedBulkActions.buttons.cancel")}
                                </ButtonV2>
                                <ButtonV2 type="button" disabled={!canConfirm} onClick={onConfirm}>
                                    {isRunning
                                        ? t("combinedBulkActions.buttons.running")
                                        : t("combinedBulkActions.buttons.confirm")}
                                </ButtonV2>
                            </>
                        )}
                    </div>
                </DialogContent>
            </Portal>
        </Dialog>
    );
};

CombinedBulkActionsModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    sections: PropTypes.arrayOf(
        PropTypes.shape({
            key: PropTypes.string.isRequired,
            label: PropTypes.node.isRequired,
            enabled: PropTypes.bool.isRequired,
            onToggleEnabled: PropTypes.func,
            content: PropTypes.node,
            result: PropTypes.object,
            disabledReason: PropTypes.node,
            isInvalid: PropTypes.bool,
        }),
    ).isRequired,
    selectedCount: PropTypes.number,
    isRunning: PropTypes.bool,
    hasAnyFailure: PropTypes.bool,
    hasRunAny: PropTypes.bool,
    onConfirm: PropTypes.func.isRequired,
    onRequestClose: PropTypes.func.isRequired,
};

export default CombinedBulkActionsModal;
