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

const MODAL_COPY = {
    close: {
        title: "interactions.bulk.motiveModal.closeTitle",
        confirm: "interactions.bulk.motiveModal.closeConfirm",
        sending: "interactions.bulk.motiveModal.closeSending",
        variant: "default",
    },
    delete: {
        title: "interactions.bulk.motiveModal.deleteTitle",
        confirm: "interactions.bulk.motiveModal.deleteConfirm",
        sending: "interactions.bulk.motiveModal.deleteSending",
        variant: "destructive",
    },
};

const InteractionsBulkMotiveModal = ({
    open,
    onOpenChange,
    onSubmit,
    isPending = false,
    count,
    motiveOptions,
    isLoadingOptions = false,
    mode,
}) => {
    const { t } = useTranslation();
    const copy = MODAL_COPY[mode] ?? MODAL_COPY.close;
    const isSubmitBlocked = isPending || isLoadingOptions || motiveOptions.length === 0 || count === 0;

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
                    <DialogTitle>{t(copy.title)}</DialogTitle>
                    <DialogDescription>{t("interactions.bulk.motiveModal.selectedCount", { count })}</DialogDescription>
                    <Formik
                        enableReinitialize
                        initialValues={{ motive: "" }}
                        validate={(values) => {
                            const errors = {};
                            if (!values.motive) {
                                errors.motive = t("interactions.bulk.validation.motiveRequired");
                            }
                            return errors;
                        }}
                        onSubmit={async (values) => {
                            await onSubmit({ motive: values.motive });
                        }}
                    >
                        {({ errors, values, setFieldValue }) => (
                            <Form className="grid gap-4">
                                <SelectField
                                    label={t("interactions.bulk.motiveModal.motive")}
                                    placeholder={
                                        isLoadingOptions
                                            ? t("interactions.bulk.loadingOptions")
                                            : t("interactions.bulk.motiveModal.motivePlaceholder")
                                    }
                                    options={motiveOptions}
                                    isLoading={isLoadingOptions}
                                    value={values.motive}
                                    defaultValue={values.motive}
                                    disabled={isSubmitBlocked}
                                    error={errors.motive}
                                    onValueChange={(value) => setFieldValue("motive", value)}
                                />
                                {motiveOptions.length === 0 && !isLoadingOptions ? (
                                    <p className="text-sm text-muted-foreground">{t("interactions.bulk.noOptions")}</p>
                                ) : null}
                                <div className="flex justify-end gap-2">
                                    <ButtonV2
                                        type="button"
                                        variant="outline"
                                        disabled={isPending}
                                        onClick={() => onOpenChange(false)}
                                    >
                                        {t("interactions.bulk.motiveModal.cancel")}
                                    </ButtonV2>
                                    <ButtonV2
                                        variant={copy.variant}
                                        disabled={isSubmitBlocked || !values.motive}
                                        type="submit"
                                    >
                                        {isPending ? t(copy.sending) : t(copy.confirm)}
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

InteractionsBulkMotiveModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    isPending: PropTypes.bool,
    count: PropTypes.number.isRequired,
    motiveOptions: PropTypes.arrayOf(
        PropTypes.shape({
            label: PropTypes.string.isRequired,
            value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
        }),
    ).isRequired,
    isLoadingOptions: PropTypes.bool,
    mode: PropTypes.oneOf(["close", "delete"]).isRequired,
};

export default InteractionsBulkMotiveModal;
