import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@kace/ui-shared";
import { t } from "i18next";
import { PropTypes } from "prop-types";

const reasonClassName = "w-48 truncate text-left";

export const ReclassificationReason = ({ reason }) => {
    if (!reason) {
        return (
            <p className={reasonClassName} id="reclassification_reason" data-testid="reclassification_reason">
                {t("case.transitions.noReason")}
            </p>
        );
    }

    return (
        <Dialog>
            <DialogTrigger asChild>
                <button
                    type="button"
                    className={`${reasonClassName} cursor-pointer hover:underline`}
                    id="reclassification_reason"
                    data-testid="reclassification_reason"
                >
                    {reason}
                </button>
            </DialogTrigger>
            <DialogContent
                className="sm:max-w-[625px]"
                aria-describedby={undefined}
                id="reclassification_reason_modal"
                data-testid="reclassification_reason_modal"
            >
                <DialogHeader>
                    <DialogTitle>{t("case.transitions.reclassificationReasonTitle")}</DialogTitle>
                </DialogHeader>
                <p
                    className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words"
                    id="reclassification_reason_full"
                    data-testid="reclassification_reason_full"
                >
                    {reason}
                </p>
            </DialogContent>
        </Dialog>
    );
};

ReclassificationReason.propTypes = {
    reason: PropTypes.string,
};
