import { Button } from "@kace/ui-shared"
import { Redo2, Undo2 } from "lucide-react"
import { PropTypes } from "prop-types"
import { REDO_COMMAND, UNDO_COMMAND } from "lexical"

export const ToggleHistoryEditor = ({
    canRedo = false,
    canUndo = false,
    editor = {},
}) => {
    return (
        <div className="flex gap-2">
            <Button
                id="toggle_history_editor_undo"
                data-testid="toggle_history_editor_undo"
                disabled={!canUndo}
                onClick={() => {
                    editor.dispatchCommand(UNDO_COMMAND, undefined)
                }}
                value="alignLeft"
                aria-label="Align Left"
                size="icon"
                type="button"
                variant="outline"
                className="disabled:cursor-no-drop"
            >
                <Undo2 className="h-4 w-4" />
            </Button>
            <Button
                id="toggle_history_editor_redo"
                data-testid="toggle_history_editor_redo"
                disabled={!canRedo}
                onClick={() => {
                    editor.dispatchCommand(REDO_COMMAND, undefined)
                }}
                value="alignLeft"
                aria-label="Align Left"
                size="icon"
                type="button"
                variant="outline"
                className="disabled:cursor-no-drop"
            >
                <Redo2 className="h-4 w-4" />
            </Button>
        </div>
    )
}

ToggleHistoryEditor.propTypes = {
    canRedo: PropTypes.bool,
    canUndo: PropTypes.bool,
    editor: PropTypes.object,
}
