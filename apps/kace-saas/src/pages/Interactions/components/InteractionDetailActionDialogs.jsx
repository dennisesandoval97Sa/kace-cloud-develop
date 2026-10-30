import PropTypes from "prop-types";
import { useEffect, useState } from "react";
import { Content, Dialog, Overlay, Portal, Title } from "@radix-ui/react-dialog";
import { Check, CircleX, Inbox, Info, Move, Trash2 } from "lucide-react";
import { cn } from "@kace_v2/shared/utils/cn.util";
import { getInteractionSubject } from "../utils/interactionDisplayUtils";

const getInteractionSender = (interaction) =>
    interaction?.client_identifier || interaction?.external_identifier || interaction?.sender || "—";

const getSelectedInteractionLabel = (interaction) => {
    const subject = getInteractionSubject(interaction);
    const sender = getInteractionSender(interaction);

    return [subject, sender].filter(Boolean).join(" · ");
};

const ActionDialogShell = ({
    open,
    onOpenChange,
    icon: Icon,
    iconClassName,
    iconBoxClassName,
    title,
    description,
    children,
    className,
}) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <Portal>
            <Overlay className="fixed inset-0 z-[60] bg-[#111827]/25 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
            <Content
                aria-describedby={undefined}
                className={cn(
                    "fixed left-1/2 top-1/2 z-[70] flex w-[calc(100vw-2rem)] max-w-[520px] -translate-x-1/2 -translate-y-1/2 flex-col gap-[18px] rounded-xl border border-gray-200 bg-white px-7 py-6 shadow-[0_18px_34px_rgba(15,23,42,0.16)] focus:outline-none",
                    className,
                )}
            >
                <div className="flex items-center gap-3.5">
                    <div
                        className={cn(
                            "flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border",
                            iconBoxClassName,
                        )}
                    >
                        <Icon className={cn("h-[22px] w-[22px]", iconClassName)} />
                    </div>
                    <div className="min-w-0 flex-1">
                        <Title className="text-xl font-extrabold leading-tight text-gray-900">{title}</Title>
                        <p className="mt-1 text-[13px] font-medium leading-tight text-gray-600">{description}</p>
                    </div>
                </div>
                {children}
            </Content>
        </Portal>
    </Dialog>
);

const NativeActionSelect = ({
    label,
    placeholder,
    value,
    options,
    onChange,
    disabled,
    error,
    icon: Icon,
    danger = false,
    tall = false,
}) => (
    <label className="flex flex-col gap-2">
        <span className="text-xs font-bold text-gray-700">{label}</span>
        <span className="relative block">
            {Icon ? (
                <Icon
                    aria-hidden="true"
                    className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8E24AA]"
                />
            ) : null}
            <select
                aria-label={label}
                value={value}
                disabled={disabled}
                onChange={(event) => onChange(event.target.value)}
                className={cn(
                    "w-full rounded-lg border bg-white px-3 text-sm font-bold text-gray-900 outline-none transition focus:border-[#8E24AA] focus:ring-2 focus:ring-[#8E24AA]/20 disabled:cursor-not-allowed disabled:opacity-60",
                    Icon ? "pl-10" : "",
                    tall ? "h-[86px] pb-10 pt-3" : "h-[46px]",
                    danger ? "border-red-200 focus:border-red-300 focus:ring-red-100" : "border-slate-300",
                    error ? "border-red-400" : "",
                )}
            >
                <option value="">{placeholder}</option>
                {options.map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </span>
        {error ? <span className="text-xs font-semibold text-red-600">{error}</span> : null}
    </label>
);

const DialogActions = ({
    cancelLabel,
    confirmLabel,
    confirmIcon: ConfirmIcon,
    confirmClassName,
    isPending,
    disabled,
    onCancel,
}) => (
    <div className="flex items-center justify-end gap-2.5">
        <button
            type="button"
            disabled={isPending}
            onClick={onCancel}
            className="flex h-[42px] items-center justify-center rounded-lg bg-white px-5 text-sm font-bold text-gray-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
            {cancelLabel}
        </button>
        <button
            type="submit"
            disabled={disabled}
            className={cn(
                "inline-flex h-[42px] items-center justify-center gap-2 rounded-lg px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60",
                confirmClassName,
            )}
        >
            <ConfirmIcon className="h-4 w-4" />
            {confirmLabel}
        </button>
    </div>
);

const useResettableValue = (open) => {
    const [value, setValue] = useState("");

    useEffect(() => {
        if (!open) {
            setValue("");
        }
    }, [open]);

    return [value, setValue];
};

const MOTIVE_DIALOG_MODE = Object.freeze({
    CLOSE: "close",
    DELETE: "delete",
});

export const InteractionMoveDialog = ({
    open,
    onOpenChange,
    interaction,
    workspaceOptions,
    isLoadingOptions = false,
    isPending = false,
    onSubmit,
    t,
}) => {
    const [workspaceId, setWorkspaceId] = useResettableValue(open);
    const isSubmitDisabled = isPending || isLoadingOptions || workspaceOptions.length === 0 || !workspaceId;

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (isSubmitDisabled) return;

        await onSubmit({ workspace_id: workspaceId });
    };

    return (
        <ActionDialogShell
            open={open}
            onOpenChange={(nextOpen) => !isPending && onOpenChange(nextOpen)}
            icon={Move}
            iconClassName="text-[#8E24AA]"
            iconBoxClassName="border-[#8E24AA55] bg-[#8E24AA14]"
            title={t("interactions.detail.actions.moveTitle", "Move interaction")}
            description={t(
                "interactions.detail.actions.moveDescription",
                "Select where you want to move this interaction.",
            )}
            className="min-h-[382px]"
        >
            <form className="flex flex-col gap-[18px]" onSubmit={handleSubmit}>
                <div className="rounded-lg border border-gray-200 bg-slate-50 px-3.5 py-3">
                    <p className="text-[11px] font-bold leading-tight text-gray-500">
                        {t("interactions.detail.actions.selectedInteraction", "Selected interaction")}
                    </p>
                    <p className="mt-1.5 truncate text-sm font-extrabold leading-tight text-gray-900">
                        {getSelectedInteractionLabel(interaction)}
                    </p>
                </div>
                <NativeActionSelect
                    label={t("interactions.detail.actions.workspaceDestination", "Destination workspace")}
                    placeholder={
                        isLoadingOptions
                            ? t("interactions.bulk.loadingOptions", "Loading options...")
                            : t("interactions.detail.actions.workspacePlaceholder", "Select a workspace")
                    }
                    value={workspaceId}
                    options={workspaceOptions}
                    onChange={setWorkspaceId}
                    disabled={isPending || isLoadingOptions || workspaceOptions.length === 0}
                    icon={Inbox}
                />
                <DialogActions
                    cancelLabel={t("interactions.detail.actions.cancel", "Cancel")}
                    confirmLabel={
                        isPending
                            ? t("interactions.bulk.moveModal.sending", "Moving...")
                            : t("interactions.bulk.moveModal.confirm", "Move")
                    }
                    confirmIcon={Move}
                    confirmClassName="bg-[#2500B8]"
                    isPending={isPending}
                    disabled={isSubmitDisabled}
                    onCancel={() => onOpenChange(false)}
                />
            </form>
        </ActionDialogShell>
    );
};

const MOTIVE_DIALOG_CONFIG = {
    [MOTIVE_DIALOG_MODE.CLOSE]: {
        icon: CircleX,
        iconClassName: "text-gray-600",
        iconBoxClassName: "border-gray-500/30 bg-gray-500/10",
        titleKey: "interactions.detail.actions.closeTitle",
        title: "Close interaction",
        descriptionKey: "interactions.detail.actions.closeDescription",
        description: "Confirm closing this interaction.",
        labelKey: "interactions.detail.actions.closeMotive",
        label: "Close motive",
        confirmKey: "interactions.detail.actions.close",
        confirm: "Close interaction",
        sendingKey: "interactions.bulk.motiveModal.closeSending",
        sending: "Closing...",
        confirmClassName: "bg-gray-950",
        confirmIcon: Check,
    },
    [MOTIVE_DIALOG_MODE.DELETE]: {
        icon: Trash2,
        iconClassName: "text-red-600",
        iconBoxClassName: "border-red-600/30 bg-red-600/10",
        titleKey: "interactions.detail.actions.deleteTitle",
        title: "Delete interaction",
        descriptionKey: "interactions.detail.actions.deleteDescription",
        description: "This action cannot be undone.",
        labelKey: "interactions.detail.actions.deleteMotive",
        label: "Delete motive",
        confirmKey: "interactions.detail.actions.delete",
        confirm: "Delete interaction",
        sendingKey: "interactions.bulk.motiveModal.deleteSending",
        sending: "Deleting...",
        confirmClassName: "bg-red-600",
        confirmIcon: Trash2,
    },
};

export const InteractionMotiveDialog = ({
    open,
    onOpenChange,
    interaction,
    motiveOptions,
    isLoadingOptions = false,
    isPending = false,
    onSubmit,
    mode,
    t,
}) => {
    const [motive, setMotive] = useResettableValue(open);
    const config = MOTIVE_DIALOG_CONFIG[mode] ?? MOTIVE_DIALOG_CONFIG[MOTIVE_DIALOG_MODE.CLOSE];
    const isDelete = mode === MOTIVE_DIALOG_MODE.DELETE;
    const isSubmitDisabled = isPending || isLoadingOptions || motiveOptions.length === 0 || !motive;
    const subject = getInteractionSubject(interaction);

    const handleSubmit = async (event) => {
        event.preventDefault();
        if (isSubmitDisabled) return;

        await onSubmit({ motive });
    };

    return (
        <ActionDialogShell
            open={open}
            onOpenChange={(nextOpen) => !isPending && onOpenChange(nextOpen)}
            icon={config.icon}
            iconClassName={config.iconClassName}
            iconBoxClassName={config.iconBoxClassName}
            title={t(config.titleKey, config.title)}
            description={t(config.descriptionKey, config.description)}
            className={cn(isDelete ? "min-h-[430px]" : "min-h-[390px]")}
        >
            <form className="flex flex-col gap-[18px]" onSubmit={handleSubmit}>
                {isDelete ? (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3.5">
                        <p className="text-sm font-extrabold leading-tight text-red-800">
                            {t("interactions.detail.actions.deleteWarningTitle", {
                                subject,
                                defaultValue: "The interaction {{subject}} will be deleted",
                            })}
                        </p>
                        <p className="mt-2 text-[13px] font-medium leading-tight text-red-900">
                            {t(
                                "interactions.detail.actions.deleteWarningDescription",
                                "The operational history associated with this view will also be lost.",
                            )}
                        </p>
                    </div>
                ) : (
                    <div className="flex items-center gap-2.5 rounded-lg border border-gray-200 bg-slate-50 px-3.5 py-3">
                        <Info className="h-[17px] w-[17px] shrink-0 text-gray-600" />
                        <p className="text-[13px] font-semibold leading-tight text-gray-700">
                            {t(
                                "interactions.detail.actions.closeNotice",
                                "The interaction will be marked as Closed and removed from the active flow.",
                            )}
                        </p>
                    </div>
                )}
                <NativeActionSelect
                    label={t(config.labelKey, config.label)}
                    placeholder={
                        isLoadingOptions
                            ? t("interactions.bulk.loadingOptions", "Loading options...")
                            : t("interactions.detail.actions.motivePlaceholder", "Select a motive")
                    }
                    value={motive}
                    options={motiveOptions}
                    onChange={setMotive}
                    disabled={isPending || isLoadingOptions || motiveOptions.length === 0}
                    danger={isDelete}
                    tall
                />
                <DialogActions
                    cancelLabel={t("interactions.detail.actions.cancel", "Cancel")}
                    confirmLabel={
                        isPending ? t(config.sendingKey, config.sending) : t(config.confirmKey, config.confirm)
                    }
                    confirmIcon={config.confirmIcon}
                    confirmClassName={config.confirmClassName}
                    isPending={isPending}
                    disabled={isSubmitDisabled}
                    onCancel={() => onOpenChange(false)}
                />
            </form>
        </ActionDialogShell>
    );
};

const optionShape = PropTypes.shape({
    label: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
});

const interactionShape = PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    description: PropTypes.string,
    subject: PropTypes.string,
    asunto: PropTypes.string,
    client_identifier: PropTypes.string,
    external_identifier: PropTypes.string,
    sender: PropTypes.string,
});

ActionDialogShell.propTypes = {
    open: PropTypes.bool.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    icon: PropTypes.elementType.isRequired,
    iconClassName: PropTypes.string.isRequired,
    iconBoxClassName: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    description: PropTypes.string.isRequired,
    children: PropTypes.element.isRequired,
    className: PropTypes.string.isRequired,
};

NativeActionSelect.propTypes = {
    label: PropTypes.string.isRequired,
    placeholder: PropTypes.string.isRequired,
    value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    options: PropTypes.arrayOf(optionShape).isRequired,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
    error: PropTypes.string,
    icon: PropTypes.elementType,
    danger: PropTypes.bool,
    tall: PropTypes.bool,
};

DialogActions.propTypes = {
    cancelLabel: PropTypes.string.isRequired,
    confirmLabel: PropTypes.string.isRequired,
    confirmIcon: PropTypes.elementType.isRequired,
    confirmClassName: PropTypes.string.isRequired,
    isPending: PropTypes.bool,
    disabled: PropTypes.bool,
    onCancel: PropTypes.func.isRequired,
};

InteractionMoveDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    interaction: interactionShape,
    workspaceOptions: PropTypes.arrayOf(optionShape).isRequired,
    isLoadingOptions: PropTypes.bool,
    isPending: PropTypes.bool,
    onSubmit: PropTypes.func.isRequired,
    t: PropTypes.func.isRequired,
};

InteractionMotiveDialog.propTypes = {
    open: PropTypes.bool.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    interaction: interactionShape,
    motiveOptions: PropTypes.arrayOf(optionShape).isRequired,
    isLoadingOptions: PropTypes.bool,
    isPending: PropTypes.bool,
    onSubmit: PropTypes.func.isRequired,
    mode: PropTypes.oneOf(Object.values(MOTIVE_DIALOG_MODE)).isRequired,
    t: PropTypes.func.isRequired,
};
