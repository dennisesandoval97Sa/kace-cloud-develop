import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dialog, Portal } from "@radix-ui/react-dialog";
import { Form, Formik } from "formik";
import { X } from "lucide-react";
import ButtonV2 from "@kace_v2/shared/ui/atoms/Button";
import DialogClose from "@kace_v2/shared/ui/atoms/DialogClose";
import DialogContent from "@kace_v2/shared/ui/atoms/DialogContent";
import DialogDescription from "@kace_v2/shared/ui/atoms/DialogDescription";
import DialogOverlay from "@kace_v2/shared/ui/atoms/DialogOverlay";
import DialogTitle from "@kace_v2/shared/ui/atoms/DialogTitle";
import SelectField from "@kace_v2/shared/ui/molecules/SelectField";
import { cn } from "@kace_v2/shared/utils/cn.util";

const InteractionsBulkMoveModal = ({
    open,
    onOpenChange,
    onSubmit,
    isPending = false,
    count,
    workspaceOptions,
    isLoadingOptions = false,
}) => {
    const { t } = useTranslation();
    const isSubmitBlocked = isPending || isLoadingOptions || workspaceOptions.length === 0 || count === 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <Portal>
                <DialogOverlay />
                <DialogContent className={cn("sm:max-w-md flex flex-col gap-4")}>
                    <DialogClose asChild>
                        <ButtonV2 size="icon" variant="outline" type="button" disabled={isPending}>
                            <X className="h-4 w-4" />
                        </ButtonV2>
                    </DialogClose>
                    <DialogTitle>{t("interactions.bulk.moveModal.title")}</DialogTitle>
                    <DialogDescription>{t("interactions.bulk.moveModal.selectedCount", { count })}</DialogDescription>
                    <Formik
                        enableReinitialize
                        initialValues={{ workspace_id: "" }}
                        validate={(values) => {
                            const errors = {};
                            if (!values.workspace_id) {
                                errors.workspace_id = t("interactions.bulk.validation.workspaceRequired");
                            }
                            return errors;
                        }}
                        onSubmit={async (values) => {
                            await onSubmit({ workspace_id: values.workspace_id });
                        }}
                    >
                        {({ errors, values, setFieldValue }) => (
                            <Form className="grid gap-4">
                                <SelectField
                                    label={t("interactions.bulk.moveModal.workspace")}
                                    placeholder={
                                        isLoadingOptions
                                            ? t("interactions.bulk.loadingOptions")
                                            : t("interactions.bulk.moveModal.workspacePlaceholder")
                                    }
                                    options={workspaceOptions}
                                    isLoading={isLoadingOptions}
                                    value={values.workspace_id}
                                    defaultValue={values.workspace_id}
                                    disabled={isSubmitBlocked}
                                    error={errors.workspace_id}
                                    onValueChange={(value) => setFieldValue("workspace_id", value)}
                                />
                                {workspaceOptions.length === 0 && !isLoadingOptions ? (
                                    <p className="text-sm text-muted-foreground">{t("interactions.bulk.noOptions")}</p>
                                ) : null}
                                <div className="flex justify-end gap-2">
                                    <ButtonV2
                                        type="button"
                                        variant="outline"
                                        disabled={isPending}
                                        onClick={() => onOpenChange(false)}
                                    >
                                        {t("interactions.bulk.moveModal.cancel")}
                                    </ButtonV2>
                                    <ButtonV2 disabled={isSubmitBlocked || !values.workspace_id} type="submit">
                                        {isPending
                                            ? t("interactions.bulk.moveModal.sending")
                                            : t("interactions.bulk.moveModal.confirm")}
                                    </ButtonV2>
                                </div>
                            </Form>
                        )}
                    </Formik>
                </DialogContent>
            </Portal>
        </Dialog>
    );
};

InteractionsBulkMoveModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    isPending: PropTypes.bool,
    count: PropTypes.number.isRequired,
    workspaceOptions: PropTypes.arrayOf(
        PropTypes.shape({
            label: PropTypes.string.isRequired,
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        }),
    ).isRequired,
    isLoadingOptions: PropTypes.bool,
};

export default InteractionsBulkMoveModal;
