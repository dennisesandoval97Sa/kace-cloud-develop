import { Card, CardHeader, CardTitle, CardContent } from "@kace/ui-shared"
import PropTypes from "prop-types"

const CardCaseStates = ({ title, icon, number, color }) => {
    return (
        <Card className="w-full h-auto transition-transform duration-150 ease-out hover:scale-105">
            <CardHeader className="p-6 pb-1">
                <CardTitle className="flex gap-2 items-center justify-between text-lg">
                    <span className="text-slate-500">{title}</span>{" "}
                    <span className={`${color} p-2 rounded-full`}>{icon}</span>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-3xl flex justify-start font-semibold">
                    {number}
                </p>
            </CardContent>
        </Card>
    )
}

CardCaseStates.propTypes = {
    title: PropTypes.string.isRequired,
    icon: PropTypes.node.isRequired,
    number: PropTypes.number.isRequired,
    color: PropTypes.string
}

export default CardCaseStates
