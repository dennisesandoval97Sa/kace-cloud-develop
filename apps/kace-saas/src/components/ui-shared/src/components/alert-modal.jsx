import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger
} from "./ui/alert-dialog"
import { useTranslation } from "react-i18next"

import PropTypes from "prop-types"

export const AlertModalShared = ({
    handleAcceptAction,
    handleCancelAction,
    nameAcceptAction = "",
    nameCancelAction = "",
    buttonAction = <></>,
    id = ""
}) => {
    const { t } = useTranslation()
    return (
        <AlertDialog>
            <AlertDialogTrigger asChild id={`btn_alert_modal_action_${id}`} data-testid={`btn_alert_modal_action_${id}`}>{buttonAction}</AlertDialogTrigger>
            <AlertDialogContent className="w-[400px]">
                <AlertDialogHeader>
                    <AlertDialogTitle id="alert_modal_title" data-testid="alert_modal_title">
                        {t("app.modals.sure")}
                    </AlertDialogTitle>
                    <AlertDialogDescription>{t("app.modals.action")}</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel
                        onClick={() => {
                            handleCancelAction && handleCancelAction(id)
                        }}
                        id={`alert_modal_cancel_${id}`}
                        data-testid={`alert_modal_cancel_${id}`}
                    >
                        {nameCancelAction}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={() => handleAcceptAction(id)}
                        id={`alert_modal_delete_${id}`}
                        data-testid={`alert_modal_delete_${id}`}
                    >
                        {nameAcceptAction}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog >
    )
}

AlertModalShared.propTypes = {
    handleAcceptAction: PropTypes.func,
    handleCancelAction: PropTypes.func,
    nameAcceptAction: PropTypes.string,
    nameCancelAction: PropTypes.string,
    buttonAction: PropTypes.node,
    id: PropTypes.string
}
