import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@kace/ui-shared";
import PropTypes from "prop-types";
import { useDispatch, useSelector } from "react-redux";
import { setOpenModal } from "../../../../redux/state/modalBehavior";
import CloseCase from "./components/CloseCase/CloseCase";
import { ReOpenCase } from "./components/ReOpenCase/ReOpenCase";
import { CloneCase } from "./components/CloneCase/CloneCase";
import { ReassignCase } from "./components/ReAssignCase/ReAssignCase";
import CombinedBulkActionsCase from "./components/CombinedBulkActions/CombinedBulkActionsCase";
import { useTranslation } from "react-i18next";

export const ConfigurableModal = ({ type = "", description, canReassign, canChangeState, canClose }) => {
    const { t } = useTranslation();

    const open = useSelector((state) => state.modalBehavior.open);
    const dispatch = useDispatch();

    const isCombined = type === "combined_bulk";

    const renderContent = () => {
        switch (type) {
            case "reopen":
                return <ReOpenCase />;
            case "reassign":
                return <ReassignCase />;
            case "clone":
                return <CloneCase />;
            case "close":
                return <CloseCase />;
            default:
                return null;
        }
    };

    /*
     * Ambos diálogos permanecen montados y solo se togglea `open`: si el árbol
     * se intercambia según `type`, la primera apertura del modal combinado
     * monta el Dialog ya abierto (remonte visible/"salto" de la animación).
     */
    return (
        <>
            <CombinedBulkActionsCase
                open={open && isCombined}
                onOpenChange={(nextOpen) => dispatch(setOpenModal(nextOpen))}
                canReassign={canReassign}
                canClose={canClose}
                canChangeState={canChangeState}
            />
            <Dialog
                open={open && !isCombined && type !== ""}
                onOpenChange={() => {
                    dispatch(setOpenModal(!open));
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t("app.title.cases")}</DialogTitle>
                        <DialogDescription>{description}</DialogDescription>
                    </DialogHeader>
                    {renderContent()}
                </DialogContent>
            </Dialog>
        </>
    );
};

ConfigurableModal.propTypes = {
    type: PropTypes.string,
    title: PropTypes.string,
    description: PropTypes.string,
    canReassign: PropTypes.bool,
    canChangeState: PropTypes.bool,
    canClose: PropTypes.bool,
};
