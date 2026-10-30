import FormCard from "@/components/core/Cards/FormCard";
import InputCard from "@/components/core/Cards/InputCard";
import SectionForm from "@/components/core/Cards/section-form";
import { SwitchStateAdmin } from "@/components/core/switchState/SwitchStateAdmin";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { CustomListCreateSchema } from "@/schemas/CustomListSchema";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { InputForm as Input, KField } from "@kace/ui-shared";
import { joiFormikAdapter } from "@kace/utils";
import MultiSelectGroups from "@kace_v2/shared/ui/organisms/MultiSelectGroups";
import { Form, Formik } from "formik";
import { PropTypes } from "prop-types";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { INITIAL_VALUES_CUSTOM_LISTS } from "../data/constants";
import { processAuxiliariesData } from "../helpers/processSelectSingle";
import { AuxiliariesTable } from "./AuxiliariesTable";
import { CustomListsFormContainer } from "./CustomListFormContainer";

/**
 * CustomListForm - Form component for creating and editing custom lists
 *
 * Manages a form with cascading auxiliary selectors, allowing users to:
 * - Select a base auxiliary (entity/schema)
 * - Add multiple related auxiliary items in a specific order
 * - Reorder and remove auxiliary items via a table
 * - Configure list status and access groups
 *
 * @component
 * @param {Object} props - Component properties
 * @param {Object} props.customList - Existing custom list data for editing (empty object for creation)
 * @param {Function} props.setCustomList - State setter for custom list (not currently used)
 * @param {Function} props.handleCustomList - Submit handler function that receives form values
 * @param {boolean} props.isPending - Loading state to disable form during submission
 * @returns {JSX.Element} Formik form with custom list fields
 */
const CustomListForm = ({
    customList: data = {},
    setCustomList: _setData,
    handleCustomList: dataHandler,
    isPending: isSending = false,
}) => {
    const { t } = useTranslation();
    // Form state management - merges initial values with existing data
    const [listaData, setListaData] = useState({ ...INITIAL_VALUES_CUSTOM_LISTS, ...data });
    // List of selected auxiliary items to display in the table
    const [auxiliariesList, setAuxiliariesList] = useState([]);
    /*
     * Counter retained (no longer used for order assignment)
     * Flag to prevent queries during initial data load (edit mode)
     */
    const [isInitialized, setIsInitialized] = useState(Object.keys(data).length === 0);

    // Helper to enforce order = index + 1
    const resequence = (list = []) => list.map((item, idx) => ({ ...item, order: idx + 1 }));

    /**
     * Query to fetch auxiliary data based on selected schema
     * Uses aux_entity or schema_name (backend compatibility)
     * Disabled during initial load in edit mode to prevent unnecessary requests
     */
    const schemaName = listaData?.aux_entity || listaData?.schema_name;
    const { data: auxiliariesData = [] } = useGenericSearchQuery({
        url: schemaName ? `${URL_AND_KEYS.auxiliaries.url}/${schemaName}` : null,
        keyQuery: schemaName ? `auxiliaries-${schemaName}` : null,
        select: processAuxiliariesData,
        enabled: !!schemaName && isInitialized,
    });

    /**
     * Effect to populate form when editing existing custom list
     * Loads all fields and transforms aux_items to table format
     */
    useEffect(() => {
        if (Object.entries(data).length !== 0) {
            Object.entries(data).forEach(([key, value]) => {
                setListaData((state) => ({
                    ...state,
                    [key]: value || "",
                }));
            });

            // Load aux_items into table when editing existing record
            if (data.aux_items && Array.isArray(data.aux_items) && data.aux_items.length > 0) {
                // Transform aux_items from backend format to table format
                const formattedItems = data.aux_items.map((item) => ({
                    id: item.aux_id || item.id,
                    literal: item.auxiliar?.description || item.name || item.aux_id || "",
                    name: item.auxiliar?.description || item.name || item.aux_id || "",
                }));

                // Always resequence based on current position
                setAuxiliariesList(resequence(formattedItems));
            }

            // Mark as initialized after loading data to enable queries
            setIsInitialized(true);
        }
    }, [data]);

    /**
     * Adds a new auxiliary item to the table
     * Prevents duplicate entries and assigns sequential order
     *
     * @param {string} auxId - The auxiliary ID to add
     * @param {string} auxName - Display name of the auxiliary
     * @param {Function} setFieldValue - Formik setter to update form values
     * @param {string} schema_id - Schema ID of the auxiliary
     */
    const handleAddAuxiliary = (auxId, auxName, setFieldValue, schema_id) => {
        if (!auxId || !auxName) return;

        // Check if auxiliary already exists in the list
        const alreadyExists = auxiliariesList.some((aux) => aux.id === auxId);
        if (alreadyExists) {
            return; // Don't add duplicates
        }

        const newAuxiliary = {
            id: auxId,
            literal: auxName,
            name: auxName,
        };

        const updatedList = resequence([...auxiliariesList, newAuxiliary]);
        setAuxiliariesList(updatedList);
        setFieldValue("aux_items", updatedList);

        // Clear the select
        setFieldValue("aux_id", "");
        setFieldValue("aux_name", "");
    };

    /**
     * Moves an auxiliary item up in the order (swaps with previous item)
     *
     * @param {number} index - Index of item to move up
     * @param {Function} setFieldValue - Formik setter to update form values
     */
    const handleMoveUp = (index, setFieldValue) => {
        if (index === 0) return;

        const updatedList = [...auxiliariesList];
        const temp = updatedList[index - 1];
        updatedList[index - 1] = updatedList[index];
        updatedList[index] = temp;

        const resequenced = resequence(updatedList);
        setAuxiliariesList(resequenced);
        setFieldValue("aux_items", resequenced);
    };

    /**
     * Moves an auxiliary item down in the order (swaps with next item)
     *
     * @param {number} index - Index of item to move down
     * @param {Function} setFieldValue - Formik setter to update form values
     */
    const handleMoveDown = (index, setFieldValue) => {
        if (index === auxiliariesList.length - 1) return;

        const updatedList = [...auxiliariesList];
        const temp = updatedList[index + 1];
        updatedList[index + 1] = updatedList[index];
        updatedList[index] = temp;

        const resequenced = resequence(updatedList);
        setAuxiliariesList(resequenced);
        setFieldValue("aux_items", resequenced);
    };

    /**
     * Removes an auxiliary item from the list
     *
     * @param {number} index - Index of item to remove
     * @param {Function} setFieldValue - Formik setter to update form values
     */
    const handleRemoveAuxiliary = (index, setFieldValue) => {
        const updatedList = auxiliariesList.filter((_, i) => i !== index);
        const resequenced = resequence(updatedList);
        setAuxiliariesList(resequenced);
        setFieldValue("aux_items", resequenced);
    };

    return (
        <Formik
            enableReinitialize={true}
            initialValues={listaData}
            validationSchema={joiFormikAdapter(CustomListCreateSchema)}
            onSubmit={(values, { setErrors, setStatus }) => {
                dataHandler(values, setErrors, setStatus);
            }}
        >
            {({ values, setFieldValue, errors, touched }) => {
                return (
                    <Form className="flex w-full justify-center" autoComplete="off" validateOnMount={false}>
                        <FormCard isId={data?.id} title={t("app.title.listasPersonalizadas")} isSending={isSending}>
                            <div className="flex flex-col col-span-3 gap-8">
                                <SectionForm title={t("customLists.form.title.information")}>
                                    <InputCard>
                                        <KField>
                                            <Input
                                                className="flex flex-col"
                                                type="text"
                                                name="name"
                                                label={t("customLists.form.fields.name")}
                                                placeholder={t("customLists.form.placeholders.name")}
                                                autoComplete={false}
                                            />
                                        </KField>
                                        <KField>
                                            <CustomListsFormContainer
                                                text={t("customLists.form.fields.auxiliary")}
                                                values={values}
                                                setFieldValue={setFieldValue}
                                                errors={errors}
                                                touched={touched}
                                                handlerAddAuxiliary={() => {
                                                    handleAddAuxiliary(
                                                        values.aux_id,
                                                        values.aux_name || values.aux_id,
                                                        setFieldValue,
                                                        values.schema_id,
                                                    );
                                                }}
                                                isPending={isSending}
                                                isInitialized={isInitialized}
                                            />
                                        </KField>
                                        <KField>
                                            <AuxiliariesTable
                                                auxiliariesList={auxiliariesList}
                                                onMoveUp={(index) => handleMoveUp(index, setFieldValue)}
                                                onMoveDown={(index) => handleMoveDown(index, setFieldValue)}
                                                onDelete={(index) => handleRemoveAuxiliary(index, setFieldValue)}
                                            />
                                        </KField>
                                    </InputCard>
                                </SectionForm>
                            </div>

                            <div className="flex flex-col gap-8 col-start-4 col-span-2">
                                <SectionForm title={t("customLists.form.title.configuration")}>
                                    <InputCard>
                                        <KField>
                                            <SwitchStateAdmin
                                                name="is_active"
                                                label={t("app.forms.status")}
                                                className="pl-1"
                                                shouldBool
                                            />
                                        </KField>
                                    </InputCard>
                                </SectionForm>
                                <SectionForm
                                    title={t("users.form.groups")}
                                    id="user_form_groups"
                                    dataTestId="user_form_groups"
                                >
                                    <InputCard>
                                        <MultiSelectGroups
                                            label={t("app.text.groups")}
                                            initialGroups={values.groups}
                                            error={errors.access_groups}
                                            handlerChange={(value) => {
                                                setFieldValue("groups", value);
                                            }}
                                        />
                                    </InputCard>
                                </SectionForm>
                            </div>
                        </FormCard>
                    </Form>
                );
            }}
        </Formik>
    );
};

CustomListForm.propTypes = {
    customList: PropTypes.object,
    setCustomList: PropTypes.func,
    handleCustomList: PropTypes.func,
    isPending: PropTypes.bool,
};

export default CustomListForm;
