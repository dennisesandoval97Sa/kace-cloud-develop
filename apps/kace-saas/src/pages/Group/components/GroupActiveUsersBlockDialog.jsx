import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui-shared/src/components/ui/alert-dialog";
import { formatActiveGroupUserName } from "../utils/activeGroupUsersDisplay";

const GroupActiveUsersBlockDialog = ({ open, count = 0, users = [], onClose }) => {
    const { t } = useTranslation();

    return (
        <AlertDialog open={open} onOpenChange={(next) => !next && onClose?.()}>
            <AlertDialogContent className="w-[calc(100%-2rem)] max-w-lg sm:max-w-xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>{t("group.activeUsersBlock.title")}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {t("group.activeUsersBlock.description", { count })}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                <div className="max-h-64 overflow-y-auto rounded-md border border-border">
                    <ul className="divide-y divide-border">
                        {users.map((user) => (
                            <li
                                key={user.email}
                                className="flex flex-col gap-0.5 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                            >
                                <span className="text-sm font-medium text-foreground break-words">
                                    {formatActiveGroupUserName(user)}
                                </span>
                                <span className="text-xs text-muted-foreground break-all sm:text-right">
                                    {user.email}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>

                {count > 8 ? (
                    <p className="text-xs text-muted-foreground">{t("group.activeUsersBlock.showing", { count })}</p>
                ) : null}

                <AlertDialogFooter>
                    <AlertDialogAction onClick={onClose}>{t("group.activeUsersBlock.close")}</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

GroupActiveUsersBlockDialog.propTypes = {
    open: PropTypes.bool,
    count: PropTypes.number,
    users: PropTypes.arrayOf(
        PropTypes.shape({
            nombres: PropTypes.string,
            apellido1: PropTypes.string,
            apellido2: PropTypes.string,
            email: PropTypes.string,
        }),
    ),
    onClose: PropTypes.func,
};

export default GroupActiveUsersBlockDialog;
