import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions";
import UserListTableContainer from "./UserListTableContainer";
import useUserListActions from "./hooks/useUserListActions";
import UserListForm from "./components/UserListForm";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import usePermissionsUser from "../../hooks/usePermissionsUser";
import { useTranslation } from "react-i18next";

const UserListHandler = () => {
    const { t } = useTranslation();
    const {
        handleDeleteUserLists,
        handleUpdateUserLists,
        handleSeeUserLists,
    } = useUserListActions();

    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "user-lists",
        actions: [
            { name: "UserListsUpdate", label: "Editar", handler: handleUpdateUserLists },
            { name: "UserListsDelete", label: `${t("app.forms.delete")}`, handler: handleDeleteUserLists },
            { name: "UserListsRead", label: `${t("app.forms.see")}`, handler: handleSeeUserLists }
        ],
        nameCreate: "UserListsCreate"
    })

    return (
        <DashboardSectionCard title="navbar.userList">
            <div className="flex flex-col gap-4">
                {canBeCreate &&
                    <DefaultIndexActions
                        buttonModal={
                            <UserListForm />
                        }
                        nameDataTestId="user_lists"
                    />
                }
                <UserListTableContainer
                    arrayAction={arrayAction}
                />
            </div>
        </DashboardSectionCard>
    )
}

export default UserListHandler
