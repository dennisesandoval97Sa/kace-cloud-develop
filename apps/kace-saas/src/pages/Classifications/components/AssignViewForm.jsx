import { PropTypes } from "prop-types";
import { Formik, Form } from "formik";
import { useMemo, useRef, useState } from "react";
import { joiFormikAdapter } from "@kace/utils";
import FormCard from "../../../components/core/Cards/FormCard";
import InputCard from "../../../components/core/Cards/InputCard";
import { ONE_SCRIPT_SERVICE } from "../../../utils/URL";
import SectionForm from "../../../components/core/Cards/section-form";
import { Button, ScrollArea, SelectByProvider } from "@kace/ui-shared";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui-shared";
import { ClassificationRelationsForm } from "../../../schemas/ClassificationRelationsSchema";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ViewsTableContainer } from "./ViewsTableContainer";
import useRelationshipTable from "../hooks/useRelationshipTable";
import { INITIAL_DATA_RELATIONSHIPS } from "../data/constants";
import { FormOneScript } from "../../../components/core/FormOneScript/FormOneScript";
import { genericView } from "../../../services/genericView";
import { PlusCircle } from "lucide-react";
import MultiSelect from "@/componentsV2/core/MultiSelect";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import useGenericSearchInfiniteQuery from "@/hooks/useGenericSearchInfiniteQuery";
import useDebounced from "@/hooks/useDebounced";
import { useOneScriptIframeHandshake } from "@kace_v2/shared/hooks/useOneScriptIframeHandshake";
import { useOneScriptHandshakeConfig } from "@kace_v2/shared/hooks/useOneScriptHandshakeConfig";

const processData = (data) => {
    const allItems = data?.pages?.flatMap(({ data }) => data) ?? [];
    return allItems
        .filter((item) => item && item.id && item.nombre)
        .map((item) => ({
            id: item.id,
            label: item.nombre,
            value: item.id,
        }));
};

const AssignViewForm = ({ dataHandler, titulo = null, isSending = false, idClassification = null }) => {
    const { t } = useTranslation();
    const [groups, setGroups] = useState([]);
    const [url, setUrl] = useState(null);
    const [viewForm, setViewForm] = useState(false);
    const [selectedView, setSelectedView] = useState({});
    const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
    const [selectedGroups, setSelectedGroups] = useState([]);
    const [groupsFilters, setGroupsFilters] = useState([]);
    const formRefOneScript = useRef(null);
    // Name is captured on selection: closing the select resets the search, reloads a list that may not include it,
    // and re-emits the same value.
    const loadedViewsRef = useRef([]);
    const { baseParams, handshakeTokens } = useOneScriptHandshakeConfig();

    const handshakeParams = useMemo(
        () => ({ ...baseParams, case_id: null, client_id: null, parent_id: null }),
        [baseParams],
    );

    useOneScriptIframeHandshake(formRefOneScript, {
        enabled: viewForm,
        params: handshakeParams,
        tokens: handshakeTokens,
    });

    const {
        data: groupsData,
        isLoading: groupsIsLoading,
        isFetchingNextPage: groupsNextPageIsLoading,
        hasNextPage: groupsHasNextPage,
        fetchNextPage,
    } = useGenericSearchInfiniteQuery({
        url: `${URL_AND_KEYS.groups.url}/search`,
        keyQuery: [URL_AND_KEYS.groups.key],
        select: processData,
        filter: groupsFilters,
    });

    const { dataTable: savedRelationships } = useRelationshipTable(idClassification);

    // A group that is already related is not pending: it would duplicate its row and fail the batch save.
    const pendingGroups = useMemo(() => {
        const savedGroupIds = new Set(savedRelationships?.data?.map((relation) => relation.group_id));
        return groups.filter((group) => !savedGroupIds.has(group.id));
    }, [groups, savedRelationships?.data]);

    const handleSelectChange = async (value) => {
        const data = await genericView(`${ONE_SCRIPT_SERVICE}/${value}`);
        if (data && data.url) {
            setUrl(data.url);
            setViewForm(true);
        }
    };

    const handleToggleGroup = (groupId) => {
        setSelectedGroups((prevGroups) => {
            if (prevGroups.some((group) => group.id === groupId)) {
                return prevGroups.filter((group) => group.id !== groupId);
            }
            const selectedGroup = groupsData?.find((group) => group.id === groupId);
            return selectedGroup ? [...prevGroups, selectedGroup] : prevGroups;
        });
    };

    const onGroupsInputChange = useDebounced((name) => {
        setGroupsFilters(
            name
                ? [
                      {
                          field: "nombre",
                          operator: "ilike",
                          type: "AND",
                          value: name,
                      },
                  ]
                : [],
        );
    }, 600);

    const removePendingGroup = (groupId) => {
        setGroups((prevGroups) => prevGroups.filter((group) => group.id !== groupId));
    };

    // Reopening discards the unsaved draft.
    const openAddGroupModal = () => {
        setSelectedGroups(groups);
        setIsAddGroupModalOpen(true);
    };

    // Every close drops the search, including a still-pending one: the box starts empty because the dialog unmounts MultiSelect.
    const closeAddGroupModal = () => {
        onGroupsInputChange.cancel();
        setGroupsFilters([]);
        setIsAddGroupModalOpen(false);
    };

    return (
        <div>
            <Formik
                enableReinitialize={true}
                initialValues={INITIAL_DATA_RELATIONSHIPS}
                validationSchema={joiFormikAdapter(ClassificationRelationsForm)}
                onSubmit={(values) => {
                    if (pendingGroups.length > 0) {
                        dataHandler(values, pendingGroups);
                    } else {
                        toast.warning(t("app.alerts.selectGroup"));
                    }
                }}
            >
                {({ values }) => {
                    return (
                        <Form
                            className="flex w-full justify-center"
                            data-testid="formClassification"
                            autoComplete="off"
                        >
                            <FormCard isId={idClassification} isSending={isSending} title={titulo}>
                                <div className="flex flex-col col-span-3 gap-8 ">
                                    <SectionForm title={t("classification.form.idOnescriptTitle")} className="w-full">
                                        <InputCard>
                                            <SelectByProvider
                                                name="form"
                                                url={`${ONE_SCRIPT_SERVICE}`}
                                                valueFrom="id"
                                                labelFrom="name"
                                                processData={(data) => {
                                                    loadedViewsRef.current = data?.data ?? [];
                                                    return data;
                                                }}
                                                onChange={(viewId) => {
                                                    const name = loadedViewsRef.current.find(
                                                        (view) => view.id === viewId,
                                                    )?.name;
                                                    setSelectedView((previous) =>
                                                        previous.id === viewId ? previous : { id: viewId, name },
                                                    );
                                                }}
                                                queryLimit={500}
                                                enableSearch
                                            />
                                        </InputCard>
                                        <InputCard>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                onClick={() => handleSelectChange(values.form)}
                                                id="btn_assign_preview_form"
                                                data-testid="btn_assign_view_form"
                                            >
                                                {t("classification.form.button.preview")}
                                            </Button>
                                        </InputCard>
                                    </SectionForm>
                                    <SectionForm>
                                        <div className="w-full flex flex-col justify-center items-center my-4">
                                            <SectionForm
                                                className="w-full 2xl:w-4/5"
                                                title={t("classification.form.formsTitle")}
                                            >
                                                <div className="flex w-full mb-2 justify-end">
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        onClick={openAddGroupModal}
                                                        id="btn_assign_group_form_modal"
                                                    >
                                                        <PlusCircle className="mr-2 h-4 w-4" />
                                                        {t("classification.form.button.addGroup")}
                                                    </Button>
                                                </div>
                                                <ViewsTableContainer
                                                    id={idClassification}
                                                    pendingData={pendingGroups.map((group) => ({
                                                        classification_id: idClassification,
                                                        group_id: group.id,
                                                        group: {
                                                            nombre: group.label,
                                                        },
                                                        one_script: {
                                                            nombre: selectedView.name,
                                                        },
                                                        id: group.id,
                                                        bgColor: "rgb(82, 197, 184)",
                                                    }))}
                                                    onRemovePending={removePendingGroup}
                                                    isSaving={isSending}
                                                />
                                            </SectionForm>
                                        </div>
                                    </SectionForm>
                                </div>
                                <div className="flex flex-col gap-8 col-start-4 col-span-2">
                                    <SectionForm
                                        title={t("classification.form.sectionPreviewTitle")}
                                        className="w-full"
                                    >
                                        <div className="flex flex-col p-2 mb-2 my-2 border-input border rounded-md justify-between">
                                            <ScrollArea className="h-[calc(29vh)]">
                                                {viewForm ? (
                                                    <FormOneScript formRef={formRefOneScript} url={url} />
                                                ) : (
                                                    <div className="text-xl italic text-center content-center grid  ">
                                                        <h1>{t("classification.form.alerts.previewOnescript")}</h1>
                                                    </div>
                                                )}
                                            </ScrollArea>
                                        </div>
                                    </SectionForm>
                                </div>
                            </FormCard>
                        </Form>
                    );
                }}
            </Formik>

            <Dialog open={isAddGroupModalOpen} onOpenChange={closeAddGroupModal}>
                <DialogContent className="sm:max-w-[640px] w-full">
                    <DialogHeader>
                        <DialogTitle>{t("classification.form.addGroupTitle")}</DialogTitle>
                        <DialogDescription>{t("classification.form.addGroupDescription")}</DialogDescription>
                    </DialogHeader>

                    <div className="py-4">
                        <MultiSelect
                            options={groupsData ?? []}
                            isLoading={groupsIsLoading || groupsNextPageIsLoading}
                            hasNextPage={groupsHasNextPage}
                            fetchNextPage={fetchNextPage}
                            onSelectOption={handleToggleGroup}
                            selectedData={selectedGroups}
                            onInputChange={onGroupsInputChange}
                            hiddenSelectedAll
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={closeAddGroupModal} type="button">
                            {t("button.cancel")}
                        </Button>
                        <Button
                            onClick={() => {
                                setGroups(selectedGroups);
                                closeAddGroupModal();
                            }}
                        >
                            {t("button.save")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

AssignViewForm.propTypes = {
    dataHandler: PropTypes.func.isRequired,
    isSending: PropTypes.bool,
    idClassification: PropTypes.string,
    titulo: PropTypes.string,
};
export default AssignViewForm;
