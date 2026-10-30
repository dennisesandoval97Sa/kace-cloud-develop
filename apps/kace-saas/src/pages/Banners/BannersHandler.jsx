import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import { BannersTableContainer } from "./components/banners-table-container"
import useBannersAction from "./hooks/useBannersAction"
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import { useTranslation } from "react-i18next"
import usePermissionsUser from "../../hooks/usePermissionsUser"

export const BannersHandler = () => {
    const { handleDeleteBanner, handleSeeBanner, handleUpdateBanner } = useBannersAction()
    const { t } = useTranslation()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "banners",
        actions: [
            { name: "BannerUpdate", label: "Editar", handler: handleUpdateBanner },
            { name: "BannerDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteBanner },
            { name: "BannerRead", label: `${t("app.forms.see")}`, handler: handleSeeBanner }
        ],
        nameCreate: "BannerCreate"
    })
    return (
        <DashboardSectionCard title="Banners">
            <div className="flex flex-col gap-4">
                {canBeCreate && <DefaultIndexActions createUrl="/banners/create" />}
                <BannersTableContainer
                    arrayAction={arrayAction}
                />
            </div>
        </DashboardSectionCard>
    )
}
