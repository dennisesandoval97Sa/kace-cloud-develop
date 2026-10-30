import DefaultIndexActions from "../../components/core/DefaultIndexActions/DefaultIndexActions"
import useActionsUser from "./hooks/useActionsUser"
import { UserTableContainer } from "./components/UserTableContainer"
import usePermissionsUser from "../../hooks/usePermissionsUser"
import { useTranslation } from "react-i18next"

const UsersHandler = () => {
    const { handleDeleteUser, handleUpdateUser, handleSeeUser } =
        useActionsUser()
    const { t } = useTranslation()
    const { arrayAction, canBeCreate } = usePermissionsUser({
        moduleId: "users",
        actions: [
            {
                name: "UsersUpdate",
                label: "Editar",
                handler: handleUpdateUser
            },
            {
                name: "UsersDelete",
                label: `${t("app.forms.delete")}`,
                handler: handleDeleteUser
            },
            {
                name: "UsersRead",
                label: `${t("app.forms.see")}`,
                handler: handleSeeUser
            }
        ],
        nameCreate: "UsersCreate"
    })

    return (
        <div className="flex flex-col gap-4">
            {canBeCreate && <DefaultIndexActions createUrl="/user/create" nameDataTestId="users" />}
            <UserTableContainer arrayAction={arrayAction} />
        </div>
    );
}

export default UsersHandler
