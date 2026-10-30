import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@kace/ui-shared";
import { Button } from "../ui-shared";
import PropTypes from "prop-types";

const LogOutModal = memo(function LogOutModal({ open, onClose, onContinue, countdown }) {
    const { t } = useTranslation();
    const bodyKey = countdown > 60 ? "sessionInactivity.willCloseInMinutes" : "sessionInactivity.willCloseInSeconds";
    const bodyCount = countdown > 60 ? Math.ceil(countdown / 60) : countdown;

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) onClose();
            }}
        >
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{t("sessionInactivity.modalTitle")}</DialogTitle>
                </DialogHeader>
                <p>{t(bodyKey, { count: bodyCount })}</p>
                <p className="text-sm text-muted-foreground">{t("sessionInactivity.dismissHint")}</p>
                <div className="flex justify-end gap-2">
                    <Button onClick={onContinue}>{t("sessionInactivity.continueSession")}</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
});

LogOutModal.propTypes = {
    open: PropTypes.bool,
    onClose: PropTypes.func,
    onContinue: PropTypes.func,
    countdown: PropTypes.number,
};

export default LogOutModal;
