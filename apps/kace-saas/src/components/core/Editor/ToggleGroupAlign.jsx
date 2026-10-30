import { ToggleGroup, ToggleGroupItem } from "@kace/ui-shared"
import { AlignCenter, AlignJustify, AlignLeft, AlignRight } from "lucide-react"
import { FORMAT_ELEMENT_COMMAND } from "lexical"
import { PropTypes } from "prop-types"

export const ToggleGroupAlign = ({ editor = null }) => {
    return (
        <ToggleGroup
            type="single"
            id="toggle_group_align"
            data-testid="toggle_group_align"
            onValueChange={(value) => {
                if (value.includes("alignLeft")) {
                    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "left")
                }
                if (value.includes("alignCenter")) {
                    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "center")
                }
                if (value.includes("alignRight")) {
                    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "right")
                }
                if (value.includes("alignJustify")) {
                    editor.dispatchCommand(FORMAT_ELEMENT_COMMAND, "justify")
                }
            }}
        >
            <ToggleGroupItem value="alignLeft" aria-label="Align Left" id="align_left_button" data-testid="align_left_button">
                <AlignLeft className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="alignCenter" aria-label="Align Center" id="align_center_button" data-testid="align_center_button">
                <AlignCenter className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="alignRight" aria-label="Align Right" id="align_right_button" data-testid="align_right_button">
                <AlignRight className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="alignJustify" aria-label="Align Justify" id="align_justify_button" data-testid="align_justify_button">
                <AlignJustify className="h-4 w-4" />
            </ToggleGroupItem>
        </ToggleGroup>
    )
}

ToggleGroupAlign.propTypes = {
    editor: PropTypes.any,
}
