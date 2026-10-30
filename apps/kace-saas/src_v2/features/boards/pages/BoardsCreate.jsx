import React from "react";
import { useTranslation } from "react-i18next";
import BoardsForm from "@kace_v2/features/boards/components/BoardsForm";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import useBoardsMutation from "@kace_v2/features/boards/hooks/useBoardsMutation.hook";

const BoardsCreate = () => {
    const { t } = useTranslation();
    const { mutateBoard, isPending, goBackFromForm } = useBoardsMutation();
    return (
        <DashboardSectionCard title="app.title.boards">
            <BoardsForm
                title={t("boards.form.createTitle")}
                labelButton={t("app.button.save")}
                handlerSubmit={mutateBoard}
                isPending={isPending}
                onBack={goBackFromForm}
            />
        </DashboardSectionCard>
    );
};

export default BoardsCreate;
