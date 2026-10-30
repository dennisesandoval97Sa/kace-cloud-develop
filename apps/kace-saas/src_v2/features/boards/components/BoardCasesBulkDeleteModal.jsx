import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dialog, Portal } from "@radix-ui/react-dialog";
import DialogOverlay from "@kace_v2/shared/ui/atoms/DialogOverlay";
import DialogContent from "@kace_v2/shared/ui/atoms/DialogContent";
import DialogClose from "@kace_v2/shared/ui/atoms/DialogClose";
import DialogTitle from "@kace_v2/shared/ui/atoms/DialogTitle";
import DialogDescription from "@kace_v2/shared/ui/atoms/DialogDescription";
import { X } from "lucide-react";
import ButtonV2 from "@kace_v2/shared/ui/atoms/Button";
import { cn } from "@kace_v2/shared/utils/cn.util";

const BoardCasesBulkDeleteModal = ({ open, onOpenChange, onSubmit, isPending, count }) => {
    const { t } = useTranslation();

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
                    <DialogTitle>{t("boards.bulkActions.deleteModal.title")}</DialogTitle>
                    <DialogDescription>{t("boards.bulkActions.deleteModal.description", { count })}</DialogDescription>
                    <div className="flex justify-end gap-2">
                        <ButtonV2
                            type="button"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => onOpenChange(false)}
                        >
                            {t("boards.bulkActions.deleteModal.cancel")}
                        </ButtonV2>
                        <ButtonV2 variant="destructive" disabled={isPending} onClick={onSubmit}>
                            {isPending
                                ? t("boards.bulkActions.deleteModal.sending")
                                : t("boards.bulkActions.deleteModal.confirm")}
                        </ButtonV2>
                    </div>
                </DialogContent>
            </Portal>
        </Dialog>
    );
};

BoardCasesBulkDeleteModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    onSubmit: PropTypes.func.isRequired,
    isPending: PropTypes.bool,
    count: PropTypes.number.isRequired,
};

export default BoardCasesBulkDeleteModal;
