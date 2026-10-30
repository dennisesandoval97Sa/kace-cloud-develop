import { ACTION_CASE_CONSTANTS } from "@kace/utils"
import { Button } from "../ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from "../ui/dropdown-menu"
import { TableOfContents } from "lucide-react"
import { PropTypes } from "prop-types"

export const DropdownActions = ({ handleActionCase }) => {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button>
                    <TableOfContents />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
                <DropdownMenuLabel>Opciones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    onClick={() => handleActionCase(ACTION_CASE_CONSTANTS[0])}
                >
                    Reabrir caso
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => handleActionCase(ACTION_CASE_CONSTANTS[1])}
                >
                    Reasignar caso
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => handleActionCase(ACTION_CASE_CONSTANTS[2])}
                >
                    Clonar caso
                </DropdownMenuItem>
                <DropdownMenuItem
                    onClick={() => handleActionCase(ACTION_CASE_CONSTANTS[3])}
                >
                    Cerrar caso
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

DropdownActions.propTypes = {
    handleActionCase: PropTypes.func
}
