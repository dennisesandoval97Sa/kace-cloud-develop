import CardCaseStates from "./card-case-states"
import PropTypes from "prop-types"

import { Link } from "react-router-dom"
import { useDispatch } from "react-redux"
import { setFilterCases } from "../../redux/state/filterCases"
import { CalendarCheck2, CalendarClock, CalendarDays, CalendarX2 } from "lucide-react"
import { formatTestId } from "@/utils/src/helpers"

const arrayIcons = [
    { icon: <CalendarCheck2 key={0} />, color: "bg-greenCustom" },
    { icon: <CalendarClock key={1} />, color: "bg-yellowCustom" },
    { icon: <CalendarX2 key={2} />, color: "bg-redCustom" },
    { icon: <CalendarDays key={3} />, color: "bg-blueCustom" }
]

const CardsContainer = ({ casesStates }) => {
    const dispatch = useDispatch()
    return (
        <div className="flex gap-8 w-full flex-col justify-center">
            <div className="grid grid-flow-row-dense md:grid-cols-2 xl:grid-rows-1 xl:grid-cols-4 md:grid-rows-2 gap-8">
                {casesStates.map(({ id, name, total, filter }, index) => {
                    const { name: filterName, column, title, color, ...rest } = filter
                    const filterCases = [{ ...rest }]
                    filterName !== "managed" &&
                        filterCases.push({
                            field: "cases.fecha_resolucion",
                            value: "null",
                            type: "AND",
                            operator: "null"
                        })
                    return (
                        <Link
                            to={"/cases"}
                            state={{ filter: filterCases }}
                            key={id}
                            onClick={() => {
                                dispatch(setFilterCases(filter))
                            }}
                            id={formatTestId("card_cases", title)}
                            data-testid={formatTestId("card_cases", title)}
                        >
                            <CardCaseStates
                                key={id}
                                icon={arrayIcons[index].icon}
                                title={name}
                                number={total}
                                color={arrayIcons[index].color}
                            />
                        </Link>
                    )
                })}
            </div>
        </div>
    )
}

CardsContainer.propTypes = {
    casesStates: PropTypes.array
}

export default CardsContainer
