/**
 * Event names and schema property keys used for dynamic attachment visibility
 * and cross-component communication within the Kace form.
 */

/** Event emitted on the form root to control attachment component visibility. Payload: { hidden: boolean } */
export const KACE_EVENT_ATTACHMENT_VISIBILITY = 'kaceAttachmentVisibility';

/** Schema key for custom JavaScript run when the component value changes (KaceBaseComponent). */
export const SCHEMA_KEY_CUSTOM_ON_CHANGE = 'customOnChange';

/** Schema key for conditional hide expression on the attachment component. */
export const SCHEMA_KEY_ATTACHMENT_HIDDEN = 'hidden';

/** Schema key for initial hidden state of the attachment component (boolean). */
export const SCHEMA_KEY_ATTACHMENT_HIDDEN_INITIAL = 'hiddenInitialValue';

export const SCHEMA_KEY_STATES_HIDE_CODE = 'hideStatesCode';

export const SCHEMA_KEY_STATES_ON_MOUNT_CODE = 'onMountCode';

export const SCHEMA_KEY_STATES_ON_CHANGE_CODE = 'onChangeCode';

/** Key of the UI object nested inside each `data_structure` rule from the aux schema API. */
export const DS_KEY_UI = 'ui';

/** When `true`, UI fields from `data_structure[fieldKey].ui` are merged onto the Form.io component. */
export const DS_UI_KEY_MODIFIED = 'ui_modified';

/** Custom field label in `data_structure[fieldKey].ui`. */
export const DS_UI_KEY_LABEL = 'label';

/** Custom CSS classes in `data_structure[fieldKey].ui` (maps to Form.io `customClass`). */
export const DS_UI_KEY_CSS = 'css';

/** Visibility flag in `data_structure[fieldKey].ui` (maps to Form.io `hidden` inverted). */
export const DS_UI_KEY_IS_VISIBLE = 'is_visible';

/** Read-only flag in `data_structure[fieldKey].ui` (maps to Form.io `disabled`). */
export const DS_UI_KEY_READ_ONLY = 'read_only';

/** Input presentation for the field in `data_structure[fieldKey].ui` (`text` | `currency`). */
export const DS_UI_KEY_INPUT_TYPE = 'input_type';

/** `input_type` value: leave Form.io defaults unchanged. */
export const DS_UI_INPUT_TYPE_TEXT = 'text';

/** `input_type` value: number fields show thousands separators (comma every thousand). */
export const DS_UI_INPUT_TYPE_CURRENCY = 'currency';

/** Form.io component `type` values that extend the Number component. */
export const FORMIO_NUMBER_COMPONENT_TYPES = ['number', 'kace_number'];
