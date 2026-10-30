import { getComponentsBuilderInfoObject } from '#util/formio.util.js';

import AuthComponent from './components/auth/index.js';
import TextFieldComponent from '#plugins/kace/components/text-field/index.js';
import SelectComponent from '#plugins/kace/components/select/index.js';
import CalendarComponent from '#plugins/kace/components/calendar/index.js';
import NumberComponent from '#plugins/kace/components/number/index.js';
import ClassificationsComponent from '#plugins/kace/components/classifications/index.js';
import ClassificationLevelsComponent from '#plugins/kace/components/classification-levels/index.js';
import AttachmentComponent from './components/attachment/index.js';
import RichTextEditorComponent from '#plugins/kace/components/rich-text-editor/index.js';
import SubmitComponent from '#plugins/kace/components/submit/index.js';
import SchemaComponent from '#plugins/kace/components/schema/index.js';
import StatesComponent from '#plugins/kace/components/states/index.js';
import OsSelectComponent from './components/os-select/index.js';
import SelectReferenceLiterals from './components/select-reference-literals/index.js';
import SelectReferenceAuxiliaries from './components/select-reference-auxiliaries/index.js';
import CustomSubmitComponent from '#plugins/kace/components/custom-submit/index.js';
import CustomSubmitNaturaComponent from '#plugins/kace/components/custom-submit-natura/index.js';
import CustomAuxLiteralsListComponent from '#plugins/kace/components/custom-aux-literals-list/index.js';
import MultiselectComponent from '#plugins/kace/components/multiselect/index.js';
import DataTableComponent from '#plugins/kace/components/data-table/index.js';
import CustomSelectComponent from '#plugins/kace/components/custom-select/index.js';
import CustomMultiselectComponent from '#plugins/kace/components/custom-multiselect/index.js';
import VoiceDictationComponent from '#plugins/kace/components/voice-dictation/index.js';
import DrawerComponent from '#plugins/kace/components/drawer/index.js';
import TimerComponent from '#plugins/kace/components/timer/index.js';
import AuxCasesSchemaComponent from './components/aux-cases-schema/index.js';
import EditGridComponent from './components/edit-grid/index.js';
import EventLogComponent from './components/event-log/index.js';
import SubcasesComponent from './components/subcases/index.js';
import CheckboxComponent from './components/checkbox/index.js';
import RadioComponent from './components/radio/index.js';
import HiddenComponent from './components/hidden/index.js';
import EmailFormComponent from './components/email-form/index.js';
import TextAreaComponent from './components/text-area/index.js';

/**
 * To include any component on this plugin add them like this:
 *
 * @example
 * ```
 * const components = {
 * 	[SomeComponent.COMPONENT_TYPE]: SomeComponent
 * }
 * ```-
 */
const components = {
  [AuthComponent.COMPONENT_TYPE]: AuthComponent,
  [ClassificationsComponent.COMPONENT_TYPE]: ClassificationsComponent,
  [ClassificationLevelsComponent.COMPONENT_TYPE]: ClassificationLevelsComponent,
  [StatesComponent.COMPONENT_TYPE]: StatesComponent,
  [AttachmentComponent.COMPONENT_TYPE]: AttachmentComponent,
  [VoiceDictationComponent.COMPONENT_TYPE]: VoiceDictationComponent,
  [RichTextEditorComponent.COMPONENT_TYPE]: RichTextEditorComponent,
  [SchemaComponent.COMPONENT_TYPE]: SchemaComponent,
  [AuxCasesSchemaComponent.COMPONENT_TYPE]: AuxCasesSchemaComponent,
  [SubmitComponent.COMPONENT_TYPE]: SubmitComponent,
  [CustomSubmitComponent.COMPONENT_TYPE]: CustomSubmitComponent,
  [CustomSubmitNaturaComponent.COMPONENT_TYPE]: CustomSubmitNaturaComponent,
  [CalendarComponent.COMPONENT_TYPE]: CalendarComponent,
  [CheckboxComponent.COMPONENT_TYPE]: CheckboxComponent,
  [HiddenComponent.COMPONENT_TYPE]: HiddenComponent,
  [NumberComponent.COMPONENT_TYPE]: NumberComponent,
  [RadioComponent.COMPONENT_TYPE]: RadioComponent,
  [SelectComponent.COMPONENT_TYPE]: SelectComponent,
  [TextFieldComponent.COMPONENT_TYPE]: TextFieldComponent,
  [TextAreaComponent.COMPONENT_TYPE]: TextAreaComponent,
  [CustomSelectComponent.COMPONENT_TYPE]: CustomSelectComponent,
  [CustomMultiselectComponent.COMPONENT_TYPE]: CustomMultiselectComponent,
  [MultiselectComponent.COMPONENT_TYPE]: MultiselectComponent,
  [OsSelectComponent.COMPONENT_TYPE]: OsSelectComponent,
  [SelectReferenceLiterals.COMPONENT_TYPE]: SelectReferenceLiterals,
  [SelectReferenceAuxiliaries.COMPONENT_TYPE]: SelectReferenceAuxiliaries,
  [CustomAuxLiteralsListComponent.COMPONENT_TYPE]:
    CustomAuxLiteralsListComponent,
  [DataTableComponent.COMPONENT_TYPE]: DataTableComponent,
  [DrawerComponent.COMPONENT_TYPE]: DrawerComponent,
  [TimerComponent.COMPONENT_TYPE]: TimerComponent,
  [EditGridComponent.COMPONENT_TYPE]: EditGridComponent,
  [EventLogComponent.COMPONENT_TYPE]: EventLogComponent,
  [SubcasesComponent.COMPONENT_TYPE]: SubcasesComponent,
  [EmailFormComponent.COMPONENT_TYPE]: EmailFormComponent,
};
const builder = {
  kace: {
    weight: 10,
    title: 'Kace Components',
    components: getComponentsBuilderInfoObject(components),
  },
};

export default {
  components,
  options: { builder: { builder } },
};
