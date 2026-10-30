import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import { ScheduleTableContainer } from "./components/ScheduleTableContainer"
import useScheduleActions from "./hooks/useScheduleActions"
import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import usePermissionsUser from "../../hooks/usePermissionsUser"
import { useTranslation } from "react-i18next"

const Schedules = () => {
    const { handleDeleteSchedule, handleSeeSchedule, handleUpdateSchedule } = useScheduleActions()
    const { t } = useTranslation()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "shift-management",
        actions: [
            {
                name: "ShiftManagementUpdate",
                label: "Editar",
                handler: handleUpdateSchedule
            },
            {
                name: "ShiftManagementDelete",
                label: `${t("app.forms.delete")}`,
                handler: handleDeleteSchedule
            },
            {
                name: "ShiftManagementsRead",
                label: `${t("app.forms.see")}`,
                handler: handleSeeSchedule
            }
        ],
        nameCreate: "ShiftManagementCreate"
    })
    return (
        <DashboardSectionCard title="app.title.schedules">
            <div className="flex flex-col gap-4">
                {canBeCreate && <DefaultIndexActions createUrl="/schedules/create" nameDataTestId="schedules" />}
                <ScheduleTableContainer arrayAction={arrayAction} />
            </div>
        </DashboardSectionCard>
    );
}

export default Schedules
