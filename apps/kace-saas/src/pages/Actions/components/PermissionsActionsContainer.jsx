import { PropTypes } from "prop-types"
import { useEffect, useState } from "react"
import { MultiSelectGroups } from "../../../components/core/multiselector/MultiSelectGroups"
import { MultiSelectUsers } from "../../../components/core/multiselector/MultiSelectUsers"
import { Label } from "../../../components/ui-shared"
import { useTranslation } from "react-i18next"

export const PermissionsActionsContainer = ({
    listGroups = [],
    setListGroups,
    includeUsers = [],
    setIncludeUsers,
    excludeUsers,
    setExcludeUsers,
    values = {}
}) => {
    const [groupsData, setGroupsData] = useState([])
    const [includeUsersData, setIncludeUsersData] = useState([])
    const [excludeUsersData, setExcludeUsersData] = useState([])
    const { t } = useTranslation()

    useEffect(() => {
        const { blackList, whiteList } = values || {}
        if (blackList && whiteList) {
            setGroupsData(
                blackList?.grupos?.map((value) => ({ id: value })) || []
            )
            setIncludeUsersData(
                whiteList?.usuarios?.map((value) => ({ id: value })) || []
            )
            setExcludeUsersData(
                blackList?.usuarios?.map((value) => ({ id: value })) || []
            )
        }
    }, [values])

    return (
        <div className="flex flex-col gap-2 items-center">
            <div className="flex gap-2 w-full">
                <div className="w-full">
                    <Label>{t("actions.title.groupActions")}</Label>
                    <MultiSelectGroups
                        listValues={listGroups}
                        setListValues={setListGroups}
                        values={
                            groupsData
                        }
                    />
                </div>
                <div className="w-full">
                    <Label>{t("actions.title.UsersActions")}</Label>
                    <MultiSelectUsers
                        listValues={includeUsers}
                        setListValues={setIncludeUsers}
                        values={
                            includeUsersData
                        }
                        enableSearch
                    />
                </div>
            </div>
            <div className="w-2/4">
                <Label>{t("actions.title.UserException")}</Label>
                <MultiSelectUsers
                    listValues={excludeUsers}
                    setListValues={setExcludeUsers}
                    values={
                        excludeUsersData
                    }
                    enableSearch
                />
            </div>
        </div>
    )
}

PermissionsActionsContainer.propTypes = {
    listGroups: PropTypes.array,
    setListGroups: PropTypes.func,
    includeUsers: PropTypes.array,
    setIncludeUsers: PropTypes.func,
    excludeUsers: PropTypes.array,
    setExcludeUsers: PropTypes.func,
    values: PropTypes.object
}
