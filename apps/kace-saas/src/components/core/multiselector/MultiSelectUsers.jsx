import { MultiSelect } from "@kace/ui-shared";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { PropTypes } from "prop-types";
import { useTranslation } from "react-i18next";
import useGenericSearchQuery from "../../../hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { handleFullName } from "../../../utils/main";
import useDebounced from "@/hooks/useDebounced";
import { notifyUserSelectionChange } from "./notifyUserSelectionChange";
import { buildDisplayUsers } from "./helpers";

const USERS_MULTISELECT_PAGE_SIZE = 100;

const selectUsersSearchResult = (payload) => {
    if (!payload) {
        return { rows: [], total: 0 };
    }
    const rows = handleFullName(payload.data) ?? [];
    const metaCount = payload.metadata?.count;
    const total =
        typeof metaCount === "object" && metaCount != null
            ? Number(metaCount.count ?? 0)
            : Number(metaCount ?? payload.total ?? 0);
    return {
        rows,
        total: Number.isFinite(total) && total > 0 ? total : 0,
    };
};

/**
 * Componente MultiSelectUsers
 *
 * Componente para seleccionar múltiples usuarios con funcionalidad de búsqueda.
 * Permite buscar usuarios por nombre, paginar resultados y mantener selecciones previas.
 *
 * @param {Array} listValues - Lista de usuarios actualmente seleccionados
 * @param {Function} setListValues - Función para actualizar la lista de usuarios seleccionados
 * @param {Array} values - Valores iniciales de usuarios (por defecto vacío)
 * @param {boolean} enableSearch - Habilita la búsqueda por nombre (por defecto false)
 * @param {boolean} groupSelectedFirst - Antepone los usuarios ya seleccionados en el
 *   desplegable (por defecto true). En false conserva el orden del catálogo de la API,
 *   como el selector de grupos, para no obligar a desplazarse por encima de lo ya elegido.
 */
export const MultiSelectUsers = ({
    listValues,
    setListValues,
    values = [],
    enableSearch = false,
    listMode = false,
    onUserSelectionChange,
    groupSelectedFirst = true,
}) => {
    const { t } = useTranslation();

    const [dataUsers, setDataUsers] = useState([]);
    const [searchFilters, setSearchFilters] = useState([]);
    const [body, setBody] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [currentSearchQuery, setCurrentSearchQuery] = useState("");
    const [hasSearched, setHasSearched] = useState(false);
    const [isSearching, setIsSearching] = useState(false);
    const [initialData, setInitialData] = useState([]);

    const hasInitializedRef = useRef(false);
    const prevValuesRef = useRef(values);
    const valuesKey = useMemo(() => values?.map((v) => v?.id).join(","), [values]);
    const lastProcessedValuesKeyRef = useRef(null);
    const userSelectionMadeRef = useRef(false);
    const idBootstrapPendingRef = useRef(false);
    const refetchAfterCatalogFilterRef = useRef(false);
    const setListValuesRef = useRef(setListValues);
    useEffect(() => {
        setListValuesRef.current = setListValues;
    }, [setListValues]);

    const handleUserSelectionChange = useCallback(
        (next) => {
            userSelectionMadeRef.current = true;
            notifyUserSelectionChange(setListValues, onUserSelectionChange, next, listValues);
        },
        [setListValues, onUserSelectionChange, listValues],
    );

    const pagination = useMemo(
        () => ({
            limit: USERS_MULTISELECT_PAGE_SIZE,
            offset: (currentPage - 1) * USERS_MULTISELECT_PAGE_SIZE,
        }),
        [currentPage],
    );

    const {
        data: dataUsersList,
        isFetching,
        refetch,
    } = useGenericSearchQuery({
        url: body ? `${URL_AND_KEYS.users.url}/searchByName` : `${URL_AND_KEYS.users.url}/search`,
        keyQuery: URL_AND_KEYS.users.key,
        select: selectUsersSearchResult,
        filter: searchFilters || [],
        body,
        enabled: false,
        pagination,
    });

    /**
     * Ejecuta la búsqueda de usuarios
     * @param {string} query - Texto de búsqueda ingresado por el usuario
     *
     * FLUJO:
     * 1. Si hay texto: configura body con el nombre y marca hasSearched = true
     * 2. Si está vacío: limpia filtros y restaura datos iniciales
     * 3. Siempre resetea a página 1
     */
    const executeSearch = useCallback(
        (query) => {
            const trimmedQuery = query?.trim();

            if (trimmedQuery) {
                setHasSearched(true);
                const bodyData = {
                    name: trimmedQuery,
                };
                setBody(bodyData);
            } else {
                setBody(null);
                setSearchFilters([]);
                setHasSearched(false);
                setIsSearching(false);
                setDataUsers(initialData);
            }
            setCurrentPage(1);
        },
        [initialData],
    );

    const debouncedSearch = useDebounced(executeSearch, 500);

    /**
     * EFECTO 1: Cargar datos cuando se abre el popover
     * Se ejecuta cuando: isPopoverOpen o refetch cambian
     */
    useEffect(() => {
        if (isPopoverOpen) {
            refetch();
            hasInitializedRef.current = true;
        }
    }, [isPopoverOpen, refetch]);

    /**
     * EFECTO 2: Inicialización con valores predefinidos
     * Se ejecuta cuando: values.length o searchFilters.length cambian
     * Propósito: Si se pasan valores iniciales (values), los carga la primera vez
     */
    useEffect(() => {
        if (!hasInitializedRef.current && values?.length > 0 && searchFilters.length > 0) {
            refetch();
            hasInitializedRef.current = true;
        }
    }, [values?.length, searchFilters.length, refetch]);

    /**
     * EFECTO 3: Paginación
     * Se ejecuta cuando: currentPage cambia
     * Propósito: Al cambiar de página (2, 3, etc.), recarga datos
     */
    useEffect(() => {
        if (currentPage > 1) {
            refetch();
        }
    }, [currentPage, refetch]);

    /**
     * EFECTO 4: Ejecutar búsqueda cuando cambia el body
     * Se ejecuta cuando: body cambia
     * Propósito: Cuando se actualiza el body con el texto de búsqueda, ejecuta refetch
     * IMPORTANTE: Solo ejecuta si body tiene contenido (name), no cuando está vacío
     */
    useEffect(() => {
        if (body !== null && hasInitializedRef.current && body?.name) {
            refetch();
        }
    }, [body, refetch]);

    /**
     * Procesa y actualiza los datos de usuarios
     * @param {Array} data - Datos de usuarios del backend
     * @param {boolean} isNewSearch - Si es una nueva búsqueda (reemplaza datos)
     * @param {boolean} isInitialLoad - Si es la carga inicial del componente
     *
     * LÓGICA:
     * 1. Transforma los datos del backend a formato del selector: { id, label, value }
     * 2. Actualiza dataUsers según el contexto:
     *    - Nueva búsqueda: reemplaza todo
     *    - Página 1 no inicial: reemplaza todo
     *    - Paginación: agrega al final (evitando duplicados)
     * 3. Si es carga inicial, también actualiza initialData (respaldo sin filtros)
     */
    const handleDataUsers = useCallback(
        (data = [], isNewSearch = false, isInitialLoad = false) => {
            const newArray = data.map((item) => ({
                id: item.id,
                label: item.nombres,
                value: item.nombres + " " + item.email,
            }));

            setDataUsers((prevUsers) => {
                if (isNewSearch) {
                    return newArray;
                } else if (currentPage === 1 && !isInitialLoad) {
                    return newArray;
                } else {
                    const existingIds = new Set(prevUsers.map((user) => user.id));
                    const newUsers = newArray.filter((user) => !existingIds.has(user.id));
                    return [...prevUsers, ...newUsers];
                }
            });

            if (isInitialLoad || (!hasSearched && currentPage === 1)) {
                setInitialData((prevInitial) => {
                    if (currentPage === 1 && !isNewSearch) {
                        return newArray;
                    } else {
                        const existingIds = new Set(prevInitial.map((user) => user.id));
                        const newUsers = newArray.filter((user) => !existingIds.has(user.id));
                        return [...prevInitial, ...newUsers];
                    }
                });
            }
        },
        [currentPage, hasSearched],
    );

    /**
     * EFECTO 5: Procesamiento de datos del backend
     * Se ejecuta cuando: dataUsersList, isFetching u otras dependencias cambian
     *
     * HACE DOS COSAS:
     * 1. Si hay valores iniciales (values) pero listValues está vacío,
     *    busca esos usuarios en los datos cargados y los establece como seleccionados
     * 2. Cuando terminan de cargar datos (!isFetching), los procesa con handleDataUsers
     */
    useEffect(() => {
        if (lastProcessedValuesKeyRef.current !== null && lastProcessedValuesKeyRef.current !== valuesKey) {
            userSelectionMadeRef.current = false;
        }

        if (!userSelectionMadeRef.current && !!values?.length && listValues.length === 0) {
            const rows = dataUsersList?.rows;
            const initialSelected = values
                .map((value) => {
                    const userData = rows?.find((user) => String(user.id) === String(value.id));
                    return userData?.id && userData?.nombres && userData?.email
                        ? {
                              id: userData.id,
                              label: userData.nombres,
                              value: userData.nombres + " " + userData.email,
                          }
                        : null;
                })
                .filter((user) => !!user);
            setListValuesRef.current(initialSelected);
            lastProcessedValuesKeyRef.current = valuesKey;
        }

        if (dataUsersList != null && !isFetching) {
            const isNewSearch = currentPage === 1 && hasSearched;
            const isInitialLoad = !hasInitializedRef.current;
            handleDataUsers(dataUsersList.rows, isNewSearch, isInitialLoad);
            setIsSearching(false);
        }
    }, [dataUsersList, isFetching, handleDataUsers, currentPage, hasSearched, valuesKey, listValues.length]);

    useEffect(() => {
        if (!userSelectionMadeRef.current && !!values?.length && listValues?.length === 0) {
            idBootstrapPendingRef.current = true;
            setSearchFilters([
                {
                    field: "id",
                    operator: "in",
                    value: values.map((user) => user?.id).join(", "),
                    type: "OR",
                },
            ]);
        }
    }, [valuesKey, listValues?.length]);

    useEffect(() => {
        if (!idBootstrapPendingRef.current || isFetching || dataUsersList == null) {
            return;
        }
        const f = searchFilters[0];
        const isIdBootstrap = searchFilters.length === 1 && f?.field === "id" && f?.operator === "in";
        if (!isIdBootstrap) {
            idBootstrapPendingRef.current = false;
            return;
        }
        idBootstrapPendingRef.current = false;
        refetchAfterCatalogFilterRef.current = true;
        setSearchFilters([]);
        setCurrentPage(1);
    }, [isFetching, searchFilters, dataUsersList]);

    useEffect(() => {
        if (!refetchAfterCatalogFilterRef.current || searchFilters.length !== 0) {
            return;
        }
        refetchAfterCatalogFilterRef.current = false;
        refetch();
    }, [searchFilters, refetch]);

    /**
     * EFECTO 7: Resetear cuando se limpian los valores
     * Se ejecuta cuando: values cambia
     *
     * Detecta cuando values se vacía completamente (el padre limpió la selección)
     * y resetea todo el estado del componente a su estado inicial.
     */
    useEffect(() => {
        const valuesChanged = JSON.stringify(prevValuesRef.current) !== JSON.stringify(values);
        if (valuesChanged && values.length === 0) {
            hasInitializedRef.current = false;
            idBootstrapPendingRef.current = false;
            refetchAfterCatalogFilterRef.current = false;
            setSearchFilters([]);
            setDataUsers([]);
            setInitialData([]);
        }
        prevValuesRef.current = values;
    }, [values]);

    /**
     * Maneja los cambios en el input de búsqueda
     * @param {Object} searchPayload - Objeto con la query de búsqueda
     *
     * FLUJO:
     * 1. Extrae el texto de búsqueda
     * 2. Si cambió respecto a la búsqueda anterior, actualiza el estado
     * 3. Si enableSearch está activo, ejecuta la búsqueda debounced (con retraso)
     */
    const handleSearch = useCallback(
        (searchPayload) => {
            const query = searchPayload?.filter || "";

            if (query !== currentSearchQuery) {
                setCurrentSearchQuery(query);

                if (enableSearch) {
                    if (query.trim() && !isSearching) {
                        setIsSearching(true);
                    }
                    debouncedSearch(query);
                }
            }
        },
        [enableSearch, debouncedSearch, currentSearchQuery, isSearching],
    );

    /**
     * Maneja cuando el popover se abre o cierra
     * @param {boolean} open - true si se está abriendo, false si se está cerrando
     *
     * Al cerrar el popover, limpia todos los filtros y búsquedas,
     * restaurando el estado a los datos iniciales.
     */
    const handlePopoverChange = useCallback(
        (open) => {
            setIsPopoverOpen(open);
            if (!open) {
                setCurrentSearchQuery("");
                setBody(null);
                setSearchFilters([]);
                setCurrentPage(1);
                setHasSearched(false);
                setIsSearching(false);
                setDataUsers(initialData);
            }
        },
        [initialData],
    );

    /**
     * Maneja el cambio de página en la paginación
     * @param {number} newPage - Nueva página seleccionada
     */
    const handlePageChange = useCallback((newPage) => {
        setCurrentPage(newPage);
    }, []);

    /**
     * Calcula qué usuarios mostrar en el selector. El orden lo resuelve
     * `buildDisplayUsers`: con `groupSelectedFirst` (por defecto) antepone los
     * seleccionados; en false conserva el orden del catálogo de la API.
     * @returns {Array} Lista de usuarios a mostrar
     */
    const displayUsers = useMemo(
        () => buildDisplayUsers(dataUsers, listValues, { hasSearched, isFetching, groupSelectedFirst }),
        [dataUsers, listValues, hasSearched, isFetching, groupSelectedFirst],
    );

    const userRows = dataUsersList?.rows;
    const usersTotal = dataUsersList?.total ?? 0;
    const hasMore =
        (userRows?.length ?? 0) === USERS_MULTISELECT_PAGE_SIZE &&
        (usersTotal <= 0 || currentPage * USERS_MULTISELECT_PAGE_SIZE < usersTotal);

    return (
        <MultiSelect
            data={displayUsers}
            textSearch={t("userList.form.textSearchUsers")}
            listValues={listValues}
            setListValues={handleUserSelectionChange}
            isLoading={(isFetching && currentPage === 1) || isSearching}
            isLoadingMore={isFetching && currentPage > 1}
            hasMore={hasMore}
            nameTesting="users"
            searchQuery={{ input: currentSearchQuery, filter: currentSearchQuery }}
            setSearchQuery={handleSearch}
            setPage={handlePageChange}
            followInput={true}
            open={isPopoverOpen}
            onOpenChange={handlePopoverChange}
            hideSearchButton
            listMode={listMode}
        />
    );
};

MultiSelectUsers.propTypes = {
    listValues: PropTypes.array,
    setListValues: PropTypes.func,
    values: PropTypes.array,
    enableSearch: PropTypes.bool,
    listMode: PropTypes.bool,
    onUserSelectionChange: PropTypes.func,
    groupSelectedFirst: PropTypes.bool,
};
