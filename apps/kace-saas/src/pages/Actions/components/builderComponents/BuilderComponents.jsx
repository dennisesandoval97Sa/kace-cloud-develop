import { FieldSelectorCustom } from "./FieldSelectorCustom"
import { CombinatorSelectorCustom } from "./CombinatorSelectorCustom"
import { AddButtonsActionCustom } from "./AddButtonsActionCustom"
import { InputValueCustom } from "./InputValueCustom"
import { RemoveActionButton } from "./RemoveActionButton"

export const BuilderComponents = {
    fieldSelector: (props) => <FieldSelectorCustom key={props.value} {...props} />,
    combinatorSelector: CombinatorSelectorCustom,
    addRuleAction: AddButtonsActionCustom,
    addGroupAction: AddButtonsActionCustom,
    operatorSelector: CombinatorSelectorCustom,
    valueEditor: InputValueCustom,
    removeRuleAction: RemoveActionButton,
    removeGroupAction: RemoveActionButton
}
