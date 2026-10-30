
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import AgendaHandler from "./AgendaHandler"

const Agenda = () => {
    return (
        <DashboardSectionCard title="app.title.agenda">
            <AgendaHandler />
        </DashboardSectionCard>
    )
}

export default Agenda
