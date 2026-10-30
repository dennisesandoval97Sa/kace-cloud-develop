import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import UsersHandler from "./UsersHandler"

const User = () => {
    return (
        <DashboardSectionCard title="app.title.user">
            <UsersHandler />
        </DashboardSectionCard>
    )
}

export default User
