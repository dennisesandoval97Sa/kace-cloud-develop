import { OPTIONS_FILTERS_TABLE } from "@kace/utils"
import { FolderClosed, FolderOpen, FolderX, WalletCards } from "lucide-react"
import PropTypes from "prop-types"
import { useDispatch } from "react-redux"
import { setCurrentColor, setFilterCases, setTitle } from "../../../../../redux/state/filterCases"
import { ButtonFilter } from "./ButtonFilter"
import { useTranslation } from "react-i18next"

export const AllButtonsFilters = ({
    onlyAll = false,
    rows = [],
    customFuction,
    isFetching = false
}) => {
    const { t } = useTranslation()
    const dispatch = useDispatch()
    const handleOnClickAll = () => {
        if (onlyAll) {
            if (customFuction) customFuction(rows)
        } else {
            dispatch(setCurrentColor(""))
            dispatch(setTitle("Casos"))
            dispatch(setFilterCases(null))
        }
    }

    return (

        <div className="flex gap-2 w-full justify-center">
            <ButtonFilter
                handleOnClick={() => handleOnClickAll()}
                textMessage={t("app.title.allGeolocationMessage")}
                icon={
                    <p className="flex gap-2 justify-center items-center">
                        <WalletCards />
                        {t("app.title.allGeolocation")}
                    </p>
                }
                className="flex gap-2"
                disabled={isFetching}
            />
            {!onlyAll && (
                <ButtonFilter
                    handleOnClick={() => {
                        dispatch(setCurrentColor("bg-blueCustom/40"))
                        dispatch(setFilterCases({
                            column: "cases.fecha_resolucion",
                            value: OPTIONS_FILTERS_TABLE.isNull,
                            title: "casos abiertos",
                            operator: OPTIONS_FILTERS_TABLE.isNull,
                            type: "AND"
                        }))
                    }}
                    textMessage="Casos abiertos"
                    icon={<FolderOpen />}
                    className="bg-blueCustom hover:bg-blueCustom/80 flex gap-2"
                    disabled={isFetching}
                />
            )}
            {!onlyAll && (
                <ButtonFilter
                    handleOnClick={() => {
                        dispatch(setCurrentColor("bg-redCustom/40"))
                        dispatch(setFilterCases({
                            column: "cases.fecha_resolucion",
                            value: OPTIONS_FILTERS_TABLE.isNull,
                            title: "casos cerrados",
                            operator: OPTIONS_FILTERS_TABLE.isNotNull,
                            type: "AND"
                        }))
                    }}
                    textMessage="Casos cerrados"
                    icon={<FolderClosed />}
                    className="bg-redCustom hover:bg-redCustom/80 flex gap-2"
                    disabled={isFetching}
                />
            )}
            {!onlyAll && (
                <ButtonFilter
                    handleOnClick={() => {
                        dispatch(setCurrentColor("bg-yellowCustom/40"))
                        dispatch(setFilterCases({
                            column: "responsable.is_active",
                            value: "1",
                            title: "casos usuarios inactivos",
                            operator: "neq",
                            type: "AND"
                        }))
                    }}
                    textMessage="Casos usuarios inactivos"
                    icon={<FolderX />}
                    className="bg-yellowCustom hover:bg-yellowCustom/80 flex gap-2"
                    disabled={isFetching}
                />
            )}
        </div>
    )
}

AllButtonsFilters.propTypes = {
    onlyAll: PropTypes.bool,
    rows: PropTypes.array,
    customFuction: PropTypes.func,
    isFetching: PropTypes.bool
}
