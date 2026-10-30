import { Card, CardHeader, CardTitle, CardContent } from "@kace/ui-shared"
import PropTypes from "prop-types"

const MassiveExecutionActionsState = ({ title, icon, number, color }) => {
    return (
        <Card className="w-full h-auto transition-transform duration-150 ease-out">
            <CardHeader className="p-6 pb-1">
                <CardTitle className="flex gap-2 items-center justify-between text-lg">
                    <div>

                    <span className="text-slate-500">{title}</span>{" "}
                    </div>
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

MassiveExecutionActionsState.propTypes = {
    title: PropTypes.string,
    icon: PropTypes.node,
    number: PropTypes.number,
    color: PropTypes.string
}

export default MassiveExecutionActionsState
