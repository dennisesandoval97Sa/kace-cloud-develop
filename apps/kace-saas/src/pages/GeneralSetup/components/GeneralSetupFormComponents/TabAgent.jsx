import { InputForm as Input, KField } from "@kace/ui-shared";
import { CheckBoxContainer } from "./CheckBoxContainer";
import { CardModulesTab } from "./CardModulesTab";
import { HeadersLabelsEditor } from "./HeadersLabelsEditor";
import { PropTypes } from "prop-types";
import { SelectByUrl } from "../../../../components/core/SelectByUrl/SelectByUrl";
import { useTranslation } from "react-i18next";
import { fieldLabels } from "../../data/constants";
import { ClientFieldCharLimits } from "./ClientFieldCharLimits";
import ExpressCases from "@/pages/GeneralSetup/components/GeneralSetupFormComponents/ExpressCases";
import SelectFromQuery from "@/componentsV2/lib/SelectFromQuery";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import Button from "@kace_v2/shared/ui/atoms/Button";
import { typeOptions } from "@/pages/Cases/components/AdminCase/components/AdminCaseLogs/components/SummarizedView/constants";
import { blockNumericSignKeys, blockNumericSignPaste } from "../../helpers";

export const TabAgent = ({ values = {}, setFieldValue, errors = {}, touched = {} }) => {
    const { t } = useTranslation();

    const eventOptions = typeOptions.map((opt) => ({ id: opt.id, value: opt.id, label: opt.label }));
    const currentEventValues = Array.isArray(values.allowed_event_types) ? values.allowed_event_types : [];
    const selectedEventData = eventOptions.filter((option) => currentEventValues.includes(option.value));

    const handleSelectEventOption = (selected) => {
        const selectedValue = typeof selected === "string" ? selected : selected?.value;
        if (!selectedValue) return;

        const isExists = currentEventValues.includes(selectedValue);
        const nextValues = isExists
            ? currentEventValues.filter((val) => val !== selectedValue)
            : [...currentEventValues, selectedValue];

        setFieldValue("allowed_event_types", nextValues);
    };

    const handleSelectAllEvents = () => {
        const allValues = eventOptions.map((option) => option.value);
        setFieldValue("allowed_event_types", allValues);
    };

    const handleClearAllEvents = () => {
        setFieldValue("allowed_event_types", []);
    };

    return (
        <div className="flex flex-col gap-4 justify-center w-full p-2">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="flex flex-col gap-4">
                    <CardModulesTab
                        title={t("generalSetup.form.title.labelCases")}
                        description={t("generalSetup.form.title.subtitleLabelCases")}
                        id="tab_agent_card_modules"
                        data-testid="tab_agent_card_modules"
                    >
                        <KField>
                            <Input
                                id="labelCases"
                                name="labelCases"
                                label={t("generalSetup.form.labels.labelCases")}
                                type="text"
                                placeholder={t("generalSetup.form.labels.labelCases")}
                                className="flex flex-col items-start justify-start text-start"
                            />
                        </KField>
                    </CardModulesTab>
                    <ExpressCases />
                    <CardModulesTab
                        title={t("generalSetup.form.title.casesTable")}
                        description={t(
                            "generalSetup.form.title.subtitleCasesTable",
                            "Configura la apariencia de las tablas de casos del agente.",
                        )}
                        id="tab_agent_cases_table"
                        data-testid="tab_agent_cases_table"
                    >
                        <div className="px-2 flex flex-col gap-3">
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_columns_dropdown")}
                                value={values.show_columns_dropdown}
                                setFieldValue={setFieldValue}
                                name="show_columns_dropdown"
                            />
                            <HeadersLabelsEditor
                                value={values.headers_labels || []}
                                setFieldValue={setFieldValue}
                                name="headers_labels"
                            />
                        </div>
                    </CardModulesTab>
                </div>
                <div className="flex flex-col gap-4">
                    <CardModulesTab
                        title={t("generalSetup.form.title.cases")}
                        description={t("generalSetup.form.title.subtitleCases")}
                    >
                        <SelectByUrl
                            name="account_to_send_link"
                            url={"mail-accounts"}
                            value={values.account_to_send_link}
                            keyQuery="mailAccountsToSend"
                            setFieldValue={setFieldValue}
                            itemLabel="description"
                            label={t("generalSetup.form.labels.account_to_send_link")}
                            error={errors.account_to_send_link}
                            touched={touched.account_to_send_link}
                        />
                        <SelectFromQuery
                            name="template_to_send_link"
                            value={values.template_to_send_link ?? ""}
                            setFieldValue={setFieldValue}
                            errorData={errors.template_to_send_link}
                            wasTouched={!!touched.template_to_send_link}
                            url="templates/search"
                            labelField="descripcion"
                            queryKey={["templatesToSend"]}
                            placeholder={t("app.forms.options")}
                            label={t("generalSetup.form.labels.template_to_send_link")}
                        />
                        <div className="px-2">
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_description")}
                                value={values.show_description}
                                setFieldValue={setFieldValue}
                                name="show_description"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_attachments")}
                                value={values.show_attachments}
                                setFieldValue={setFieldValue}
                                name="show_attachments"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.allow_client_send_attachments")}
                                value={values.allow_client_send_attachments}
                                setFieldValue={setFieldValue}
                                name="allow_client_send_attachments"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_sheduler")}
                                value={values.show_sheduler}
                                setFieldValue={setFieldValue}
                                name="show_sheduler"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_event_log")}
                                value={values.show_event_log}
                                setFieldValue={setFieldValue}
                                name="show_event_log"
                            />
                            {values.show_event_log && (
                                <div className="px-4 pb-2 flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-medium">
                                            {t(
                                                "generalSetup.form.labels.allowed_events",
                                                "Seleccionar eventos visibles",
                                            )}
                                        </label>
                                        <Button
                                            onClick={handleClearAllEvents}
                                            variant="ghost"
                                            size="sm"
                                            className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
                                            disabled={currentEventValues.length === 0}
                                            type="button"
                                        >
                                            {t("app.forms.clearAll")}
                                        </Button>
                                    </div>
                                    <MultiSelect
                                        selectedData={selectedEventData}
                                        options={eventOptions}
                                        onSelectOption={handleSelectEventOption}
                                        placeholder={t(
                                            "generalSetup.form.labels.select_events",
                                            "Seleccionar eventos...",
                                        )}
                                        single={false}
                                        onSelectedAll={handleSelectAllEvents}
                                        showDeselectAll
                                        onDeselectAll={handleClearAllEvents}
                                    />
                                </div>
                            )}
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_comment_tab")}
                                value={values.show_comment_tab}
                                setFieldValue={setFieldValue}
                                name="show_comment_tab"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_interactions")}
                                value={values.show_interactions}
                                setFieldValue={setFieldValue}
                                name="show_interactions"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_case")}
                                value={values.show_case}
                                setFieldValue={setFieldValue}
                                name="show_case"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_client")}
                                value={values.show_client}
                                setFieldValue={setFieldValue}
                                name="show_client"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_transitions")}
                                value={values.show_transitions}
                                setFieldValue={setFieldValue}
                                name="show_transitions"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_subcase")}
                                value={values.show_subcase}
                                setFieldValue={setFieldValue}
                                name="show_subcase"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_time_counter")}
                                value={values.show_time_counter}
                                setFieldValue={setFieldValue}
                                name="show_time_counter"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_time_description_prefixes")}
                                value={values.show_time_description_prefixes}
                                setFieldValue={setFieldValue}
                                name="show_time_description_prefixes"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_notifications")}
                                value={values.show_notifications}
                                setFieldValue={setFieldValue}
                                name="show_notifications"
                            />
                        </div>
                        {values.show_notifications && (
                            <SelectFromQuery
                                name="notifications_one_script_form"
                                value={values.notifications_one_script_form ?? ""}
                                setFieldValue={setFieldValue}
                                errorData={errors.notifications_one_script_form}
                                wasTouched={!!touched.notifications_one_script_form}
                                url="/one_script/search"
                                labelField="name"
                                queryKey={["oneScript", "notifications"]}
                                placeholder={t("app.forms.options")}
                                label={t("generalSetup.form.labels.notifications_one_script_form")}
                            />
                        )}
                    </CardModulesTab>
                    <CardModulesTab
                        title={t("generalSetup.form.title.asesor")}
                        description={t("generalSetup.form.title.subtitleAsesor")}
                        id="tab_agent_adviser"
                        data-test="tab_agent_adviser"
                    >
                        <div className="px-2 gap-2 flex flex-col">
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_my_assigned_cases")}
                                value={values.show_my_assigned_cases}
                                setFieldValue={setFieldValue}
                                name="show_my_assigned_cases"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_my_created_cases")}
                                value={values.show_my_created_cases}
                                setFieldValue={setFieldValue}
                                name="show_my_created_cases"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.enable_custom_view")}
                                value={values.enable_custom_view}
                                setFieldValue={setFieldValue}
                                name="enable_custom_view"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_boards")}
                                value={values.show_boards}
                                setFieldValue={setFieldValue}
                                name="show_boards"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_subcases_button")}
                                value={values.show_subcases_button}
                                setFieldValue={setFieldValue}
                                name="show_subcases_button"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.show_agent_interactions")}
                                value={values.show_agent_interactions}
                                setFieldValue={setFieldValue}
                                name="show_agent_interactions"
                            />
                            <Input
                                id="cases_agent_refresh_min"
                                name="cases_agent_refresh_min"
                                label={t("generalSetup.form.labels.cases_agent_refresh_min")}
                                type="number"
                                min="0"
                                placeholder={t("generalSetup.form.labels.value_min")}
                                className="flex flex-col items-start justify-start text-start"
                                value={values.cases_agent_refresh_min ?? "1"}
                                onChange={(e) => setFieldValue("cases_agent_refresh_min", e.target.value)}
                                onKeyDown={blockNumericSignKeys}
                                onPaste={blockNumericSignPaste}
                            />
                        </div>
                    </CardModulesTab>
                </div>
                <div className="flex flex-col gap-4">
                    <CardModulesTab
                        title={t("generalSetup.form.title.calendar_oneScript")}
                        description={t("generalSetup.form.title.subtitle_calendar_oneScript")}
                        id="tab_agent_calendar_oneScript"
                        data-testid="tab_agent_calendar_oneScript"
                    >
                        <KField>
                            <SelectFromQuery
                                name="oneScript_calendar"
                                value={values.oneScript_calendar ?? ""}
                                setFieldValue={setFieldValue}
                                errorData={errors.oneScript_calendar}
                                wasTouched={!!touched.oneScript_calendar}
                                url="/one_script/search"
                                labelField="name"
                                queryKey={["oneScript", "calendar"]}
                                placeholder={t("app.forms.options")}
                                label={t("generalSetup.form.labels.oneScript")}
                            />
                        </KField>
                    </CardModulesTab>
                    <CardModulesTab
                        title={t("generalSetup.form.title.header")}
                        description={t("generalSetup.form.title.subtitleHeader")}
                        id="tab_agent_header"
                        data-test="tab-agent_header"
                    >
                        <KField>
                            <Input
                                id="custom_logo"
                                name="custom_logo"
                                label={t("generalSetup.form.labels.url")}
                                type="text"
                                placeholder={t("generalSetup.form.labels.url")}
                                className="flex flex-col items-start justify-start text-start"
                            />
                        </KField>
                        <div className="px-2">
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.high_impact_fields")}
                                value={values.high_impact_fields}
                                setFieldValue={setFieldValue}
                                name="high_impact_fields"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.helps")}
                                value={values.helps}
                                setFieldValue={setFieldValue}
                                name="helps"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.total_cases_by_ans")}
                                value={values.total_cases_by_ans}
                                setFieldValue={setFieldValue}
                                name="total_cases_by_ans"
                            />
                            <CheckBoxContainer
                                text={t("generalSetup.form.labels.my_agenda")}
                                value={values.my_agenda}
                                setFieldValue={setFieldValue}
                                name="my_agenda"
                            />
                        </div>
                    </CardModulesTab>
                </div>
                <CardModulesTab
                    title={t("generalSetup.form.title.clients")}
                    description={t("generalSetup.form.title.subtitleClients")}
                    id="tab_agent_clients"
                    data-test="tab_agent_clients"
                >
                    <KField>
                        <Input
                            id="content_habeas_data"
                            name="content_habeas_data"
                            label={t("generalSetup.form.labels.habeasData")}
                            type="text"
                            placeholder={t("generalSetup.form.labels.habeasData")}
                            className="flex flex-col items-start justify-start text-start"
                        />
                    </KField>
                    <SelectFromQuery
                        name="custom_form_id"
                        value={values.custom_form_id ?? ""}
                        setFieldValue={setFieldValue}
                        errorData={errors.custom_form_id}
                        wasTouched={!!touched.custom_form_id}
                        url="/one_script/search"
                        labelField="name"
                        queryKey={["oneScript", "customForm"]}
                        placeholder={t("app.forms.options")}
                        label={t("generalSetup.form.labels.oneScript")}
                        onClear={() => {
                            setFieldValue("custom_form_id", "");
                            setFieldValue("show_aux_client_expanded", false);
                            setFieldValue("hide_client_form", false);
                        }}
                    />
                    <div className="px-2">
                        {values.custom_form_id && (
                            <>
                                <CheckBoxContainer
                                    text={t("generalSetup.form.labels.show_aux_client_expanded")}
                                    value={values.show_aux_client_expanded}
                                    setFieldValue={setFieldValue}
                                    name="show_aux_client_expanded"
                                />
                                <CheckBoxContainer
                                    text={t("generalSetup.form.labels.hide_client_form")}
                                    value={values.hide_client_form}
                                    setFieldValue={setFieldValue}
                                    name="hide_client_form"
                                />
                            </>
                        )}
                        <CheckBoxContainer
                            text={t("generalSetup.form.labels.show_client_data")}
                            value={values.show_client_data}
                            setFieldValue={setFieldValue}
                            name="show_client_data"
                        />
                        <CheckBoxContainer
                            text={t("generalSetup.form.labels.client_data")}
                            value={values.client_data}
                            setFieldValue={setFieldValue}
                            name="client_data"
                        />
                        <CheckBoxContainer
                            text={t("generalSetup.form.labels.habeasData")}
                            value={values.habeasData}
                            setFieldValue={setFieldValue}
                            name="habeasData"
                        />
                        <CheckBoxContainer
                            text={t("generalSetup.form.labels.open_cases")}
                            value={values.open_cases}
                            setFieldValue={setFieldValue}
                            name="open_cases"
                        />
                        <CheckBoxContainer
                            text={t("generalSetup.form.labels.close_cases")}
                            value={values.close_cases}
                            setFieldValue={setFieldValue}
                            name="close_cases"
                        />
                        <CheckBoxContainer
                            text={t("generalSetup.form.labels.get_list_field_to_show")}
                            value={values.get_list_field_to_show}
                            setFieldValue={setFieldValue}
                            name="get_list_field_to_show"
                        />
                        <CheckBoxContainer
                            text={t("generalSetup.form.labels.show_cases_button")}
                            value={values.show_cases_button}
                            setFieldValue={setFieldValue}
                            name="show_cases_button"
                        />
                        <CheckBoxContainer
                            text={t("generalSetup.form.labels.show_save_client_button")}
                            value={values.show_save_client_button}
                            setFieldValue={setFieldValue}
                            name="show_save_client_button"
                        />
                        <CheckBoxContainer
                            text={t("generalSetup.form.labels.show_new_client_button")}
                            value={values.show_new_client_button}
                            setFieldValue={setFieldValue}
                            name="show_new_client_button"
                        />
                        <CheckBoxContainer
                            text={t("generalSetup.form.labels.show_update_button")}
                            value={values.show_update_button}
                            setFieldValue={setFieldValue}
                            name="show_update_button"
                        />
                    </div>
                </CardModulesTab>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <CardModulesTab
                    title={t("generalSetup.form.title.clientsForm")}
                    description={t("generalSetup.form.title.subtitleClientesForm")}
                    id="tab_agent_clients_form"
                    data-test="tab-agent_clients_form"
                >
                    <div className="px-2">
                        {fieldLabels.map((label, index) => (
                            <CheckBoxContainer
                                key={`field_${label}_${index + 1}`}
                                text={t(`generalSetup.form.labels.${label}_bool`)}
                                value={values[`field_${label}`]}
                                setFieldValue={setFieldValue}
                                name={`field_${label}`}
                            />
                        ))}
                    </div>
                </CardModulesTab>
                <CardModulesTab
                    title={t("generalSetup.form.title.searchCases")}
                    description={t("generalSetup.form.title.subtitleSearchCases")}
                    id="tab_agent_search_cases"
                    data-testid="tab_agent_search_cases"
                >
                    <div className="px-2">
                        {[...fieldLabels, "reference"].map((label, index) => (
                            <CheckBoxContainer
                                key={`field_${label}_bold_${index + 1}`}
                                text={t(`generalSetup.form.labels.${label}_bool`)}
                                value={values[`${label}_bool`]}
                                setFieldValue={setFieldValue}
                                name={`${label}_bool`}
                            />
                        ))}
                    </div>
                </CardModulesTab>
                <CardModulesTab
                    title={t("generalSetup.form.title.clientsFormEdit")}
                    description={t("generalSetup.form.title.subtitleClientsFormEdit")}
                    id="tab_agent_clients_form_edit"
                    data-test="tab_agent_clients_form_edit"
                >
                    <div className="px-2">
                        {[...fieldLabels].map((label, index) => (
                            <CheckBoxContainer
                                key={`field_${label}_edit_${index + 1}`}
                                text={t(`generalSetup.form.labels.${label}_bool`)}
                                value={values[`field_${label}_edit`]}
                                setFieldValue={setFieldValue}
                                name={`field_${label}_edit`}
                            />
                        ))}
                    </div>
                </CardModulesTab>
                <CardModulesTab
                    title={t("generalSetup.form.title.clientsFormRequired")}
                    description={t("generalSetup.form.title.subtitleClientsFormRequired")}
                    id="tab_agent_clients_form_required"
                    data-test="tab_agent_clients_form_required"
                >
                    <div className="px-2">
                        {[...fieldLabels].map((label, index) => (
                            <CheckBoxContainer
                                key={`field_${label}_required_${index + 1}`}
                                text={t(`generalSetup.form.labels.${label}_bool`)}
                                value={values[`field_${label}_required`]}
                                setFieldValue={setFieldValue}
                                name={`field_${label}_required`}
                            />
                        ))}
                    </div>
                </CardModulesTab>
                <div className="flex flex-col gap-4">
                    <CardModulesTab
                        title={t("generalSetup.form.title.clientsFormCopy")}
                        description={t("generalSetup.form.title.subtitleClientsFormCopy")}
                        id="tab_agent_clients_form_copy"
                        data-test="tab_agent_clients_form_copy"
                    >
                        <div className="px-2">
                            {[...fieldLabels].map((label, index) => (
                                <CheckBoxContainer
                                    key={`field_${label}_copy_${index + 1}`}
                                    text={t(`generalSetup.form.labels.${label}_bool`)}
                                    value={values[`field_${label}_copy`]}
                                    setFieldValue={setFieldValue}
                                    name={`field_${label}_copy`}
                                />
                            ))}
                        </div>
                    </CardModulesTab>
                </div>
                <CardModulesTab
                    title={t("generalSetup.form.title.clientsFormMaxMin")}
                    description={t("generalSetup.form.title.subtitleClientsFormMaxMin")}
                    id="tab_agent_form_max_min"
                    data-test="tab_agent_form_max_min"
                >
                    <div className="flex flex-col gap-2 px-2">
                        {fieldLabels.map((label) => (
                            <ClientFieldCharLimits key={`field_${label}_min_max`} label={label} />
                        ))}
                    </div>
                </CardModulesTab>
            </div>
        </div>
    );
};

TabAgent.propTypes = {
    values: PropTypes.object,
    setFieldValue: PropTypes.func,
    errors: PropTypes.object,
    touched: PropTypes.object,
};
