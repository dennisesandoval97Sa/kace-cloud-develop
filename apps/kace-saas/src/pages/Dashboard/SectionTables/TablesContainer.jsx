import { CardTableGroups } from "./CardTableGroups"
import { CardTableResponsible } from "./CardTableResponsible"


export const TablesContainer = () => {
    return (
        <div className="flex flex-col gap-8">
            <CardTableGroups />
            <CardTableResponsible />
        </div>
    )
}
