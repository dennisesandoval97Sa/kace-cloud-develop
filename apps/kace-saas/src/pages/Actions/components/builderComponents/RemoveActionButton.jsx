import { Button } from "@kace/ui-shared"
import { X } from "lucide-react"
import { PropTypes } from "prop-types"

export const RemoveActionButton = ({ ...props }) => {
    const { handleOnClick, testID } = props
    return (
        <Button
            size="icon"
            variant="destructive"
            className="h-9 w-9 px-2"
            onClick={handleOnClick}
            data-testid={testID === "remove-rule" ? "btn_remove_rule" : "btn_remove_goup"}
            id={testID === "remove-rule" ? "btn_remove_rule" : "btn_remove_goup"}
        >
            <X />
        </Button>
    )
}

RemoveActionButton.propTypes = {
    handleOnClick: PropTypes.func.isRequired,
    testID: PropTypes.string.isRequired
}
