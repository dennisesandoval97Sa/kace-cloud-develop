
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard"
import UserUpdateHandler from "./UsersUpdateHandler"

const UserUpdate = () => {
    return (
        <DashboardSectionCard title={"app.title.user"}>
            <UserUpdateHandler />
        </DashboardSectionCard>
    )
}

export default UserUpdate
