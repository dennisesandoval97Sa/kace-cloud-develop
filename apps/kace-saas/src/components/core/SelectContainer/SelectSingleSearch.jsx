import React, { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import { cn } from "../../ui-shared/src/lib/utils";
import {
    Label,
    Popover,
    PopoverContent,
    PopoverTrigger,
    Button,
    Command,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandInput,
} from "@kace/ui-shared";
import useGenericSearchQuery from "../../../hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";
import { LoaderThreeDots } from "../../ui-shared/src/components/LoaderThreeDots";
import { CheckIcon, ChevronsUpDown } from "lucide-react";
import { GeneralLoader } from "../../ui-shared/src/components/general-loader";
import { useTranslation } from "react-i18next";
import useDebounced from "../../../hooks/useDebounced";
import { genericSearchService } from "@/utils/src/services/genericSearchService";

const processDataUser = (data = []) => {
    return data?.data.map((item) => {
        return {
            id: item.id,
            value: item.nombres + " " + (item.apellido1 ?? "") + " " + (item.apellido2 ?? ""),
            label: item.nombres + " " + (item.apellido1 ?? "") + " " + (item.apellido2 ?? ""),
        };
    });
};

const bodyFiltersParams = (value) => ({
    filter: [
        {
            field: "nombres",
            operator: "ilike",
            value,
            type: "OR",
        },
        {
            field: "apellido1",
            operator: "ilike",
            value,
            type: "OR",
        },
        {
            field: "apellido2",
            operator: "ilike",
            value,
            type: "OR",
        },
    ],
    order: { field: "created_at", direction: "desc" },
    limit: 10,
    offset: 0,
});

const formatUsers = (activeUsers) => {
    return activeUsers?.map((user) => {
        const fullName = `${user.nombres} ${user.apellido1 ?? ""} ${user.apellido2 ?? ""}`.trim();
        return {
            id: user.id,
            label: fullName,
            value: fullName,
        };
    });
};

const getDefaultSearchConfig = (url, keyQuery) => {
    const isCustomConfig = !!url && !!keyQuery;

    return {
        urlSearch: url ?? URL_AND_KEYS.users.url,
        keyQuerySearch: keyQuery ?? URL_AND_KEYS.users.key,
        isCustomConfig,
    };
};

export const SelectSingleSearch = ({
    setFieldValue,
    name = "",
    value = "",
    bodyFilter = bodyFiltersParams,
    searchFilter = [],
    contentText = "",
    error = "",
    formatData = formatUsers,
    keyQuery = URL_AND_KEYS.users.key,
    placeholderText = "",
    processData = processDataUser,
    title = "",
    touched = false,
    url = URL_AND_KEYS.users.url,
}) => {
    const [open, setOpen] = useState(false);
    const { t } = useTranslation();
    const containerRef = useRef(null);
    const [users, setUsers] = useState([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [searchValue, setSearchValue] = useState("");

    const { urlSearch, keyQuerySearch, isCustomConfig } = getDefaultSearchConfig(url, keyQuery);

    const { data, isLoading } = useGenericSearchQuery({
        url: `${urlSearch}/search`,
        keyQuery: keyQuerySearch,
        select: processData,
        filter: searchFilter,
    });

    const findOption = (options) => options?.find((option) => option.id === value);
    const isUsersSearch = urlSearch === URL_AND_KEYS.users.url;

    // The list only holds one page, so a selected user outside it is resolved by id (users.search allows `id in`).
    const { data: selectedOptions } = useGenericSearchQuery({
        url: `${urlSearch}/search`,
        keyQuery: `${keyQuerySearch}-selected`,
        searchById: value,
        filter: [{ field: "id", operator: "in", value, type: "AND" }],
        select: processData,
        enabled: isUsersSearch && !!value && !isLoading && !findOption(data),
    });

    useEffect(() => {
        if (data && (!isCustomConfig || (isCustomConfig && data?.length > 0))) {
            setUsers(data);
        }
    }, [data]);

    const debouncedOnChange = useDebounced(async (event) => {
        try {
            if (event?.length > 0) {
                setSearchLoading(true);
                const baseBody = bodyFilter(event);
                const body =
                    urlSearch === URL_AND_KEYS.users.url
                        ? { name: event }
                        : {
                              ...(baseBody && typeof baseBody === "object" ? baseBody : {}),
                          };

                const url = urlSearch === URL_AND_KEYS.users.url ? `${urlSearch}/searchByName` : `${urlSearch}/search`;

                const formattedData = await genericSearchService(url, [], null, body);
                const format = formatData(formattedData?.data || []);

                setUsers(format);
            } else {
                setUsers(data);
            }
        } catch {
            setUsers(data);
        } finally {
            setSearchLoading(false);
        }
    }, 500);

    return (
        <div className="flex flex-col gap-2">
            {title && (
                <div className="flex justify-between">
                    <Label className={cn(!!error && touched && "border-redCustom text-redCustom")}>{t(title)}</Label>
                    {!!error && touched && <Label className="text-redCustom">{error}</Label>}
                </div>
            )}
            <Popover
                open={open}
                onOpenChange={(isOpen) => {
                    setOpen(isOpen);
                    if (isOpen) {
                        setSearchValue("");
                        setUsers(data);
                    }
                }}
            >
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        aria-expanded={open}
                        className="w-full justify-between"
                        disabled={isLoading || searchLoading}
                        id={`btn_select_single_search_${value}`}
                        data-testid={`btn_select_single_search_${value}`}
                    >
                        {isLoading || searchLoading ? (
                            <LoaderThreeDots />
                        ) : value ? (
                            (findOption(users) ?? findOption(selectedOptions))?.label
                        ) : (
                            t(contentText?.length ? contentText : "generalSetup.form.labels.selectAUser")
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[350px] p-0" side="top">
                    <Command shouldFilter={false}>
                        <CommandInput
                            value={searchValue}
                            onValueChange={(val) => {
                                setSearchValue(val);
                                debouncedOnChange(val);
                            }}
                            placeholder={t(
                                placeholderText?.length ? placeholderText : "generalSetup.form.labels.searchForUsers",
                            )}
                            data-testid={`input_single_search_${searchValue || ""}`}
                            id={`input_single_search_${searchValue || ""}`}
                        />
                        <CommandList ref={containerRef} style={{ maxHeight: "300px", overflowY: "auto" }}>
                            {isLoading ? (
                                <div className="flex justify-center items-center p-4 h-36 w-full">
                                    <GeneralLoader />
                                </div>
                            ) : users?.length === 0 ? (
                                <CommandEmpty>{t("genericTexts.noFoundInformation")}</CommandEmpty>
                            ) : (
                                <CommandGroup>
                                    {users?.map((item) => (
                                        <CommandItem
                                            data-testid={`item_multiselect_${item.id}`}
                                            key={item.id}
                                            value={item.value}
                                            onSelect={() => {
                                                setFieldValue(name, item.id);
                                                setOpen(false);
                                            }}
                                            id={`item_multiselect_${item.id}`}
                                        >
                                            <CheckIcon
                                                className={cn(
                                                    "mr-2 h-4 w-4",
                                                    value === item.id ? "opacity-100" : "opacity-0",
                                                )}
                                            />
                                            {item?.label}
                                        </CommandItem>
                                    ))}
                                </CommandGroup>
                            )}
                        </CommandList>
                    </Command>
                </PopoverContent>
            </Popover>
        </div>
    );
};

SelectSingleSearch.propTypes = {
    setFieldValue: PropTypes.func,
    name: PropTypes.string,
    value: PropTypes.string,
    bodyFilter: PropTypes.func,
    searchFilter: PropTypes.array,
    contentText: PropTypes.string,
    error: PropTypes.string,
    formatData: PropTypes.func,
    keyQuery: PropTypes.string,
    placeholderText: PropTypes.string,
    processData: PropTypes.func,
    title: PropTypes.string,
    touched: PropTypes.bool,
    url: PropTypes.string,
};
