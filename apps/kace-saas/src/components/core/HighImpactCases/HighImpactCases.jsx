import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@kace/ui-shared"
import { Bell } from "lucide-react"
import { GENERIC_HEADERS } from "../../../pages/Cases/data/Constants"
import { CasesTableComponent } from "../CasesTableComponent/CasesTableComponent"
import { PropTypes } from "prop-types"

export const HighImpactCases = ({ handleUpdateCases }) => {
    const actions = [
        {
            name: "Ver",
            action: handleUpdateCases
        }
    ]
    return (
        <Dialog id="dialog_high_impact_cases"
            data-testid="dialog_high_impact_cases">
            <DialogTrigger id="dialog_trigger_high_impact_cases"
                data-testid="dialog_trigger_high_impact_cases">
                <Bell className="fill-redCustom" id="icon_bell_high_impact_cases"
                    data-testid="icon_bell_high_impact_cases" />
            </DialogTrigger>
            <DialogContent className="max-w-[90vw] w-full max-h-[700px] overflow-x-auto" id="dialog_content_high_impact_cases"
                data-testid="dialog_content_high_impact_cases">
                <DialogHeader id="dialog_header_high_impact_cases"
                    data-testid="dialog_header_high_impact_cases">
                    <DialogTitle id="dialog_title_high_impact_cases" data-testid="dialog_title_high_impact_cases"
                    >Casos de alto impacto</DialogTitle>
                </DialogHeader>
                <CasesTableComponent
                    id="table_high_impact_cases"
                    data-testid="table_high_impact_cases"
                    altoImpacto={true}
                    headerProps={GENERIC_HEADERS}
                    keyQueryProps="casesByHighImpact"
                    actionProps={actions}
                    searchCasesParamsProps={{
                        column: "alto_impacto",
                        value: "eq",
                        valueToSearch: 1
                    }}
                    showFilterGeneric={false}
                />
            </DialogContent>
        </Dialog>
    )
}

HighImpactCases.propTypes = {
    handleUpdateCases: PropTypes.func
}
