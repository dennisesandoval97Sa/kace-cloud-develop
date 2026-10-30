import {
    Card,
    CardHeader,
    CardTitle,
    CardContent,
    Command,
    CommandInput,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem
} from "@kace/ui-shared"
import PropTypes from "prop-types"
import {
    AlertModalShared,
    cn,
    GeneralLoader
} from "../../../components/ui-shared"
import { useTranslation } from "react-i18next"
import { BaseModalCreate } from "./BaseModalCreate"
import { EmptyIcon } from "../../../components/ui-shared/src/icons"
import { EditIcon, Plus, TrashIcon } from "lucide-react"
import { useParent } from "../LiteralContext"
import { formatTestId } from "@/utils/src/helpers"

export const BaseCard = ({
    isLoadingFieldsData = false,
    isEmpty = false,
    fieldsData = [],
    selected,
    onChangeSelected,
    handleDelete,
    title = "",
    type = "",
    selectObject
}) => {
    const { t } = useTranslation()
    const { setParentId } = useParent()
    return (
        <Card
            className="w-96 z-20"
            style={{
                height: "calc(100vh - 10rem)",
            }}
        >
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    {title}
                    <BaseModalCreate iconAction={<Plus />} isIcon type={type} selected={selectObject} labelTest={formatTestId("base_modal_create", `${title}`)} />
                </CardTitle>
            </CardHeader>
            <CardContent
                className="overflow-auto p-2"
                style={{
                    height: "calc(100vh - 16rem)",
                }}
            >
                <Command className="rounded-none">
                    {isLoadingFieldsData ? (
                        <GeneralLoader />
                    ) : (
                        <>
                            {!isEmpty && (
                                <div className="w-full">
                                    <CommandInput
                                        placeholder={t("app.forms.search")}
                                        id="base_card_input_search"
                                        data-testid="base_card_input_search"
                                    />
                                </div>
                            )}
                            <CommandList className="max-h-full w-full" id="base_card_list" data-testid="base_card_list">
                                {isEmpty ? (
                                    <CommandEmpty className="w-full h-52 flex gap-2 font-semibold justify-center items-center">
                                        <EmptyIcon /> <span>{t("app.text.noFields")}</span>
                                    </CommandEmpty>
                                ) : (
                                    <CommandGroup className="w-full overflow-y-auto">
                                        {fieldsData.map((field) => (
                                            <CommandItem
                                                key={field.id}
                                                value={field.nombre}
                                                className={cn(
                                                    "flex justify-between mb-2 items-center hover:cursor-pointer gap-2 data-[selected='true']:bg-transparent",
                                                    {
                                                        "bg-primary/90  data-[selected='true']:bg-primary/90 data-[selected='false']:bg-primary/90":
                                                            field.id === selected?.id,
                                                    },
                                                )}
                                                onSelect={() => {
                                                    onChangeSelected(type, field);
                                                    setParentId(field.id);
                                                }}
                                                id={formatTestId("select_base_card", `${field.nombre}`)}
                                                data-testid={formatTestId("select_base_card", `${field.nombre}`)}
                                            >
                                                <span
                                                    id={formatTestId("span_select_card", `${field.nombre}`)}
                                                    data-testid={formatTestId("span_select_card", `${field.nombre}`)}
                                                >
                                                    {field.nombre}
                                                </span>
                                                <div className="flex justify-center items-center bg-backgroundContainer rounded-md p-2 h-10">
                                                    <button
                                                        type="button"
                                                        className="flex justify-center items-center gap-1"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                        }}
                                                        id={formatTestId("bnt_select_delete", `${field.nombre}`)}
                                                        data-testid={formatTestId("bnt_select_delete", `${field.nombre}`)}
                                                    >
                                                        <AlertModalShared
                                                            nameAcceptAction={t("app.forms.delete")}
                                                            nameCancelAction={t("app.forms.cancel")}
                                                            handleAcceptAction={() => handleDelete(field)}
                                                            id={field.id}
                                                            buttonAction={<TrashIcon width={18} height={18} />}
                                                        />
                                                        <BaseModalCreate
                                                            iconAction={<EditIcon width={18} height={18} />}
                                                            data={field}
                                                            isIcon
                                                            variantProp="ghost"
                                                            className="w-auto h-auto"
                                                            type={type}
                                                            selected={selectObject}
                                                            id={formatTestId("bnt_select_modal_create", `${field.nombre}`)}
                                                            data-testid={formatTestId("bnt_select_modal_create", `${field.nombre}`)}
                                                        />
                                                    </button>
                                                </div>
                                            </CommandItem>
                                        ))}
                                    </CommandGroup>
                                )}
                            </CommandList>
                        </>
                    )}
                </Command>
            </CardContent>
        </Card >
    );
}

BaseCard.propTypes = {
    isLoadingFieldsData: PropTypes.bool,
    isEmpty: PropTypes.bool,
    fieldsData: PropTypes.array,
    selected: PropTypes.object,
    onChangeSelected: PropTypes.func,
    handleDelete: PropTypes.func,
    title: PropTypes.string,
    type: PropTypes.string,
    selectObject: PropTypes.object
}
