import { formatTestId } from "@/utils/src/helpers"
import { Separator } from "@kace/ui-shared"
import { t } from "i18next"
import { PropTypes } from "prop-types"

export const DashboardSectionCard = ({ children, title }) => {
    return (
        <section className="relative">
            <h1 className="text-3xl font-bold py-1"
                data-testid={formatTestId("section", title, { clean: true })}
                id={formatTestId("section", title, { clean: true })}>
                {t(title)}
            </h1>
            {title && <Separator className="mb-4" />}
            {children}
        </section>
    )
}

DashboardSectionCard.propTypes = {
    children: PropTypes.node.isRequired,
    title: PropTypes.string
}
