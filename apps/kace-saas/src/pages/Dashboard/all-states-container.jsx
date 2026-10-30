import { Button, Card, CardContent } from "@kace/ui-shared"
import PropTypes from "prop-types"
import { Link, useNavigate } from "react-router-dom"
import { SquareArrowUpRight, Waypoints } from "lucide-react"
import { t } from "i18next"
import { useDispatch } from "react-redux"
import { setFilterCases } from "../../redux/state/filterCases"
import { formatTestId } from "@/utils/src/helpers"

const AllStatesContainer = ({ informationStates }) => {
    const navigate = useNavigate()
    const dispatch = useDispatch()

    const handleShowDataCases = (filterByState) => {
        dispatch(setFilterCases(filterByState))
        navigate("/cases")
    }

    return (
        <Card className="p-2 h-96 flex flex-col overflow-hidden">
            <CardContent className="overflow-auto p-2">
                {informationStates.length === 0 ? (
                    <div className="flex justify-center items-center gap-4 h-full">
                        <Waypoints className="h-24 w-24" />
                        <p>{t("text.noAvailableStates")}</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-2">
                        {informationStates.map(({ id, name, total, color, filter }) => (
                            <div
                                key={id}
                                className={`bg-backgroundContainer px-4 py-2 flex justify-between items-center rounded-md ${color}`}
                            >
                                <p className="text-sm font-semibold">
                                    {name} {total}
                                </p>
                                <Link
                                    to={"/cases"}
                                    state={{ filter }}
                                    key={id}
                                    onClick={() => {
                                        dispatch(setFilterCases(filter))
                                    }}
                                    id={formatTestId("states_container", name)}
                                    data-testid={formatTestId("states_container", name)}
                                    className="pointer rounded-sm bg-white p-2 border border-gray-200 hover:bg-gray-200"
                                >
                                    <SquareArrowUpRight className="bg-white rounded-sm"/>
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card >
    )
}

AllStatesContainer.propTypes = {
    informationStates: PropTypes.array
}

export default AllStatesContainer
