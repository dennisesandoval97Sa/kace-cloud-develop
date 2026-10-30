import { DashboardSectionCard } from "../../../components/core/Cards/DashboardSectionCard"
import { useParams, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { FullCalendarShedule } from "./FullCalendarShedule/FullCalendarShedule"

export const FullCalendarCase = () => {
    const { id } = useParams()
    const { t } = useTranslation()
    const location = useLocation()

    return (
        <DashboardSectionCard title={t("diary.calendar.title")}>
            <div className="flex flex-col gap-4">
                <FullCalendarShedule
                    idCase={id}
                    admin={location.pathname.includes("/cases/calendar/")}
                    pageBack={true}
                />
            </div>
        </DashboardSectionCard>
    )
}
