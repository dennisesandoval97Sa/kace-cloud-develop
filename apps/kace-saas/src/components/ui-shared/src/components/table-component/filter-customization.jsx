import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogClose,
} from "../ui/dialog";
import PropTypes from "prop-types";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { SearchFilter } from "./search-filter-save";
import { DialogNewFilter } from "./DialogNewFilter";
import { useForm } from "react-hook-form";
import { LoaderThreeDots } from "../LoaderThreeDots";
import { Filter, RefreshCcw } from "lucide-react";
import useHookFilterOld from "./hooks/useHookFilterOld";
import { InputValueDependDeprecate } from "./InputValueDependDeprecate";

export function FilterCustomization({
    nameHelper = [],
    nameTable = {},
    isLoadingHeaders = false,
    refetch,
    isFetching = false,
    keyQueryData = "",
    columnsToFilter = null,
}) {
    const { handleSubmit, control, reset, setValue } = useForm({
        defaultValues: {},
    });
    const { t } = useTranslation();

    const {
        modalNewFilter,
        toastAlertFilter,
        columnsData,
        onSubmit,
        handleSelectFilter,
        dataFiltersUser,
        handleNewFilter,
        setModalNewFilter,
        handleHelpers,
        setValueOfLevel,
        appliedFilterValues,
        setAppliedFilterValues,
        initialValues,
    } = useHookFilterOld({
        nameHelper,
        nameTable,
        setValue,
        reset,
        keyQueryData,
        columnsToFilter,
    });
    return (
        <div className="flex gap-2 items-center">
            <Dialog>
                <DialogTrigger asChild>
                    <Button
                        variant="outline"
                        className="font-semibold text-lg"
                        size="sm"
                        onClick={() => {
                            handleHelpers();
                            toast.dismiss(toastAlertFilter);
                            reset(appliedFilterValues ?? undefined);
                        }}
                        id="btn_filter_custom"
                        data-testid="btn_filter_custom"
                    >
                        {isLoadingHeaders ? <LoaderThreeDots /> : <Filter />}
                    </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[625px] max-h-[550px] overflow-auto">
                    <DialogHeader>
                        <DialogTitle id="filter_customization_title" data-testid="filter_customization_title">
                            {t("app.text.filters")}
                        </DialogTitle>
                        <DialogDescription
                            id="filter_customization_description"
                            data-testid="filter_customization_description"
                        >
                            {t("app.text.filterHelp")}
                        </DialogDescription>
                    </DialogHeader>
                    <form
                        onSubmit={handleSubmit(onSubmit)}
                        autoComplete="off"
                        id="form_filter_customization"
                        data-testid="form_filter_customization"
                    >
                        <div className="grid grid-flow-row-dense grid-cols-1 md:grid-cols-2 gap-2 py-4">
                            {columnsData.map(({ column_name, header, data_type, options }) => (
                                <div className="flex flex-col gap-4" key={column_name}>
                                    <Label
                                        htmlFor={column_name}
                                        className="text-left ml-2 mt-2"
                                        id={`filter_customization_label_${column_name}`}
                                        data-testid={`filter_customization_label_${column_name}`}
                                    >
                                        {header === "Nivel 1"
                                            ? "Niveles"
                                            : nameTable.table === "helps" && column_name === "titulo"
                                              ? "Titulo"
                                              : header}
                                    </Label>
                                    {InputValueDependDeprecate(
                                        data_type,
                                        column_name,
                                        options,
                                        control,
                                        setValueOfLevel,
                                    )}
                                </div>
                            ))}
                        </div>
                        <DialogFooter>
                            <div className="flex w-full justify-between">
                                <SearchFilter
                                    handleSelectFilter={handleSelectFilter}
                                    nameTable={nameTable.table}
                                    dataUser={dataFiltersUser}
                                />
                                <DialogClose asChild>
                                    <Button
                                        type="submit"
                                        id="btn_filter_custom_search"
                                        data-testid="btn_filter_custom_search"
                                    >
                                        {t("app.forms.search")}
                                    </Button>
                                </DialogClose>
                            </div>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
            <Button
                size="sm"
                variant="outline"
                onClick={() => {
                    refetch();
                    setAppliedFilterValues(null);
                    reset(initialValues);
                }}
                className={`flex gap-2 ${isFetching && "text-primary"}`}
                id="btn_filter_custom_update"
                data-testid="btn_filter_custom_update"
            >
                <RefreshCcw className={`${isFetching && "animate-spin"}`} />
                <span>{isFetching ? t("app.states.updating") : t("app.button.update")}</span>
            </Button>
            <DialogNewFilter open={modalNewFilter} save={handleNewFilter} setOpen={setModalNewFilter} />
        </div>
    );
}

FilterCustomization.propTypes = {
    filterSave: PropTypes.array,
    nameHelper: PropTypes.array,
    nameTable: PropTypes.shape({
        table: PropTypes.string.isRequired,
        view: PropTypes.string,
    }),
    isLoadingHeaders: PropTypes.bool,
    refetch: PropTypes.func,
    isFetching: PropTypes.bool,
};
