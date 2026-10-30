import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import DefaultIndexActions from "@/components/core/DefaultIndexActions/DefaultIndexActions";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import usePermissionsUser from "@kace/hooks/usePermissionsUser";
import { MODULES } from "@kace_v2/shared/constants/modules.contants";
import useBoardsListActions from "@kace_v2/features/boards/hooks/useBoardsListActions.hook";
import BoardsTableContainer from "@kace_v2/features/boards/components/BoardsTableContainer";

const BoardsList = () => {
    const { t } = useTranslation();
    const { handleSeeBoard, handleUpdateBoard, handleDeleteBoard, handleDownloadBoard } = useBoardsListActions();

    /*
     * Solo se filtra por permiso de modulo: el acceso al tablero concreto lo resuelve el
     * backend, que ya recorta el listado a lo que el llamante puede abrir y operar.
     */
    const actions = useMemo(
        () => [
            {
                name: MODULES.BOARDS.PERMISSIONS.READ,
                label: t("app.forms.see"),
                handler: handleSeeBoard,
            },
            {
                name: MODULES.BOARDS.PERMISSIONS.UPDATE,
                label: t("app.forms.edit"),
                handler: handleUpdateBoard,
            },
            {
                name: MODULES.BOARDS.PERMISSIONS.EXPORT,
                label: t("app.forms.download"),
                handler: handleDownloadBoard,
            },
            {
                name: MODULES.BOARDS.PERMISSIONS.DELETE,
                label: t("app.forms.delete"),
                handler: handleDeleteBoard,
            },
        ],
        [t, handleSeeBoard, handleUpdateBoard, handleDownloadBoard, handleDeleteBoard],
    );

    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: MODULES.BOARDS.ID,
        actions,
        nameCreate: MODULES.BOARDS.PERMISSIONS.CREATE,
    });

    return (
        /*
         * DashboardSectionCard no es solo el titulo: su <section relative> es el ancla del
         * "+" de DefaultIndexActions, que se posiciona absolute sin declarar relative propio.
         * Sin este envoltorio el boton se cuelga del <main> del layout y queda fuera de vista.
         */
        <DashboardSectionCard title="app.title.boards">
            <div className="flex flex-col gap-4" data-testid="boards-page">
                {canBeCreate && (
                    <DefaultIndexActions createUrl={MODULES.BOARDS.ROUTES.CREATE} nameDataTestId="boards" />
                )}
                <BoardsTableContainer arrayAction={arrayAction} />
            </div>
        </DashboardSectionCard>
    );
};

export default BoardsList;
