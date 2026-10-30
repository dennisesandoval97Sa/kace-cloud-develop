import { GeneralLoader, Label } from "@kace/ui-shared";
import { PenOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import useAdminCaseComments from "../hooks/useAdminCaseComments";
import { CommentsItems } from "./AdminCaseCommentsItems";

const AdminCaseCommentsHistory = () => {
    const { comments, loading } = useAdminCaseComments();
    const { t } = useTranslation();

    return (
        <div
            className="col-span-1 flex min-h-0 min-w-0 flex-1 flex-col items-center overflow-hidden rounded-md bg-background drop-shadow-md max-sm:text-sm"
            id="comments_history_container"
            data-testid="comments_history_container"
        >
            <Label className="p-4 font-bold text-2xl" id="comments_history_title" data-testid="comments_history_title">
                {t("case.comments.history")}
            </Label>
            {loading ? (
                <GeneralLoader />
            ) : comments?.length === 0 ? (
                <div
                    className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4"
                    id="comments_history_empty"
                    data-testid="comments_history_empty"
                >
                    <PenOff className="h-20 w-20" />
                    <span>{t("case.comments.noComments")}</span>
                </div>
            ) : (
                <div
                    className="min-h-0 w-full max-w-full flex-1 overflow-auto p-2"
                    id="comments_history_list_wrapper"
                    data-testid="comments_history_list_wrapper"
                >
                    <ul id="comments_history_list" data-testid="comments_history_list">
                        {comments?.map((item, index) => (
                            <CommentsItems
                                key={index}
                                item={item}
                                currentIndex={index}
                                id={`comment_item_${index}`}
                                data-testid={`comment_item_${index}`}
                            />
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default AdminCaseCommentsHistory;
