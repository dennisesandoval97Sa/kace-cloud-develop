import { LITERALS_SERVICE } from "../../../utils/URL";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteInformation, sendInformation } from "../../../services/generic-send-information";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { formatDataBeforePost, handleLiteralMutationError } from "../helpers";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import useGenericSearchQuery from "../../../hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "../../../utils/urlAndKeys";

const LISTS = ["tipo_documento", "sexo", "estado_civil"];

const extractUUID = (str) => {
    const match = str.match(/[0-9a-fA-F-]{36}/);
    return match ? match[0] : null;
};

const useLiteralHook = ({ setOpen = null } = {}) => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [literals, setLiterals] = useState([]);
    const [options, setOptions] = useState([]);
    const configAdmin = useSelector((state) => state.generalSetup.configAdmin);

    const [selected, setSelected] = useState({
        literal: null,
        field: null,
    });

    const { data: dataModels, isLoading: isLoadingData } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.literals.url}/search`,
        keyQuery: URL_AND_KEYS.literals.key,
        filter: [
            {
                field: "tipo_literal",
                operator: "null",
                value: "null",
                type: "AND",
            },
            {
                field: "is_active",
                operator: "eq",
                value: "1",
                type: "AND",
            },
        ],
        pagination: { limit: 0, offset: 0 },
        select: (data) => data.data,
    });

    const { mutate: mutateNew, isPending: isLoadingNewField } = useMutation({
        mutationFn: sendInformation,
        onError: (err) => handleLiteralMutationError(err, t),
        onSuccess: (_id, context) => {
            queryClient.invalidateQueries({
                predicate: (query) => query.queryKey[0]?.startsWith(URL_AND_KEYS.literals.key),
            });
            toast.success(`Modelo ${context.dataPost.nombre} creado exitosamente`);
            setOpen && setOpen(false);
        },
    });

    const { mutate: mutateUpdate, isPending: isUpdating } = useMutation({
        mutationFn: sendInformation,
        onError: (err) => handleLiteralMutationError(err, t),
        onSuccess: (_id, context) => {
            if (context.dataPost?.tipo_literal) {
                queryClient.invalidateQueries({
                    predicate: (query) => {
                        const [key, filters] = query.queryKey;
                        if (key !== URL_AND_KEYS.literals.keyId) return false;
                        return (
                            Array.isArray(filters) &&
                            filters.some((filter) => filter.value === context.dataPost.tipo_literal)
                        );
                    },
                });
            } else {
                queryClient.invalidateQueries({
                    predicate: (query) => query.queryKey[0]?.startsWith(URL_AND_KEYS.literals.key),
                });
            }
            toast.success(`Modelo ${context.dataPost.nombre} editado exitosamente`);
            setOpen && setOpen(false);
        },
    });

    const { mutate: mutateDelete, isPending: isDeleting } = useMutation({
        mutationFn: deleteInformation,
        onError: () => {
            toast.error(t("app.alerts.dontAction"));
        },
        onSuccess: (_data, context) => {
            const uuid = extractUUID(context);
            if (uuid === selected?.literal?.id) {
                setSelected({
                    literal: null,
                    field: null,
                });
            }
            queryClient.invalidateQueries({
                predicate: (query) => query.queryKey[0]?.startsWith(URL_AND_KEYS.literals.key),
            });
            toast.success("Modelo eliminado exitosamente");
            setOpen && setOpen(false);
        },
    });

    const onChangeSelected = (key, value) => {
        setSelected((prev) => ({
            ...prev,
            [key]: prev[key] === value ? null : value,
        }));
    };

    const handleLiteral = async (values, isChild = true) => {
        if (isLoadingNewField || isUpdating) return;
        const { id } = values;
        values.tipo_literal = values.tipo_literal === "" ? null : values.tipo_literal;
        if (id && !isChild) {
            delete values.tipo_literal;
            delete values.value;
        } else {
            delete values.value;
        }
        const url = id ? `${LITERALS_SERVICE}/${id}` : `${LITERALS_SERVICE}`;
        const dataPost = formatDataBeforePost(values, id);
        const data = { id, url, dataPost };
        id ? mutateUpdate(data) : mutateNew(data);
    };

    const handleDeleteModel = (field) => {
        if (isDeleting) return;
        mutateDelete(`${LITERALS_SERVICE}/${field.id}/delete`);
    };

    useEffect(() => {
        if (dataModels) {
            const someName = dataModels.some((item) => item.nombre === "clientes");
            if (someName) {
                if (!configAdmin?.clients) {
                    setLiterals(dataModels);
                    return;
                }
                const optionsGeneral = Object.entries(configAdmin.clients)
                    .map(([key, value]) => {
                        if (LISTS.includes(key)) {
                            return {
                                label: value,
                                value: key,
                            };
                        }
                        return null;
                    })
                    .filter((item) => item);
                setOptions(optionsGeneral);
            }
            setLiterals(dataModels);
        }
    }, [dataModels]);

    useEffect(() => {
        onChangeSelected("field", null);
    }, [selected.literal]);

    return {
        handleLiteral,
        literals,
        isLoadingNewField: isLoadingNewField || isUpdating,
        handleDeleteModel,
        isLoadingData,
        options,
        selected,
        onChangeSelected,
    };
};

export default useLiteralHook;
