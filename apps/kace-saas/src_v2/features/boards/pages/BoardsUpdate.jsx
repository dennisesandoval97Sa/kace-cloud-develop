import React from "react";
import { useTranslation } from "react-i18next";
import useBoardsMutation from "@kace_v2/features/boards/hooks/useBoardsMutation.hook";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import BoardsForm from "@kace_v2/features/boards/components/BoardsForm";
import useBoard from "@kace_v2/features/boards/hooks/useBoard.hook";

const BoardsUpdate = () => {
    const { t } = useTranslation();
    const { boardConfig } = useBoard();
    // La pagina sabe que es una edicion; el hook espera un booleano, no la configuracion.
    const { mutateBoard, isPending, goBackFromForm } = useBoardsMutation(true);

    return (
        <DashboardSectionCard title="app.title.boards">
            <BoardsForm
                title={t("boards.form.updateTitle")}
                labelButton={t("app.button.update")}
                handlerSubmit={mutateBoard}
                isPending={isPending}
                initialData={boardConfig}
                onBack={goBackFromForm}
            />
        </DashboardSectionCard>
    );
};

export default BoardsUpdate;
