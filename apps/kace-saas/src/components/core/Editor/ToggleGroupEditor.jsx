import { ToggleGroup, ToggleGroupItem } from "@kace/ui-shared"
import { PropTypes } from "prop-types"
import { Bold, Italic, Underline, Strikethrough } from "lucide-react"
import { FORMAT_TEXT_COMMAND } from "lexical"

export const ToggleGroupEditor = ({ valuesToggle = [], editor = null }) => {
    return (
        <ToggleGroup
            type="multiple"
            value={valuesToggle}
            onValueChange={(value) => {
                if (value.length > valuesToggle.length) {
                    const valuesToAdd = value.filter(
                        (item) => !valuesToggle.includes(item),
                    )[0]
                    editor.dispatchCommand(FORMAT_TEXT_COMMAND, valuesToAdd)
                } else {
                    const formatToRemove = valuesToggle.filter(
                        (item) => !value.includes(item),
                    )[0]
                    editor.dispatchCommand(FORMAT_TEXT_COMMAND, formatToRemove)
                }
            }}
            id="toggle_group"
            data-testis="toggle_group"
        >
            <ToggleGroupItem value="bold" aria-label="Toggle bold" id="toggle_bold" data-testid="toggle_bold">
                <Bold className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="italic" aria-label="Toggle italic" id="toggle_italic" data-testid="toggle_italic">
                <Italic className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="underline" aria-label="Toggle underline" id="toggle_underline" data-testid="toggle_underline">
                <Underline className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem
                value="strikethrough"
                aria-label="Toggle Strikethrough"
                id="toggle-strikethrough"
                data-testid="toggle_strikethrough"
            >
                <Strikethrough className="h-4 w-4" />
            </ToggleGroupItem>
        </ToggleGroup>
    )
}

ToggleGroupEditor.propTypes = {
    valuesToggle: PropTypes.array,
    editor: PropTypes.object,
}
