import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { CaseStatusCounter } from "../CaseStatusCounter";

export function CaseStatusCounterModal({ open, onOpenChange, caseStatusCounter, trigger }) {
    const { t } = useTranslation();

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-auto">
                <DialogHeader>
                    <DialogTitle id="case_status_counter_modal_title" data-testid="case_status_counter_modal_title">
                        {t("gridMain.text.estadosCaso")}
                    </DialogTitle>
                </DialogHeader>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-2">
                    {caseStatusCounter.map((item, index) => (
                        <CaseStatusCounter
                            key={`case_status_counter_modal_${index}`}
                            title={item.title}
                            number={item.number}
                            icon={item.icon}
                            color={item.color}
                        />
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}

CaseStatusCounterModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    caseStatusCounter: PropTypes.arrayOf(
        PropTypes.shape({
            title: PropTypes.string.isRequired,
            number: PropTypes.number.isRequired,
            icon: PropTypes.node,
            color: PropTypes.string,
        }),
    ).isRequired,
    trigger: PropTypes.node.isRequired,
};
