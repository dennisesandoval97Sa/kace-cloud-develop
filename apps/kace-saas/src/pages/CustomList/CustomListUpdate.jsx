import useGeneralMutation from "@/hooks/useGeneralMutation";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import { genericView } from "@/services/genericView";
import { CUSTOM_LISTS_SERVICE } from "@/utils/URL";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { GeneralLoader } from "@kace/ui-shared";
import { removeKey } from "@kace/utils";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import CustomListForm from "./components/CustomListForm";
import { CUSTOM_LISTS, CUSTOM_LISTS_PATH, INITIAL_VALUES_CUSTOM_LISTS } from "./data/constants";
import { parseCustomListData } from "./utils/customListHandler";

/**
 * Componente handler para la actualización y creación de listas personalizadas.
 * Gestiona la carga de datos existentes, el procesamiento del formulario y el envío de datos.
 *
 * @component
 * @returns {JSX.Element} Formulario de lista personalizada con datos cargados o loader
 */
const CustomListUpdateHandler = () => {
    // Obtiene el ID desde los parámetros de la URL
    const { id } = useParams();

    // Determina si está en modo edición o creación
    const isEditMode = !!id;

    // Estado local para almacenar los datos de la lista personalizada
    const [customList, setCustomList] = useState(INITIAL_VALUES_CUSTOM_LISTS);

    // Query para obtener los datos de la lista personalizada si existe un ID
    const { data, isLoading } = useQuery({
        queryKey: [CUSTOM_LISTS.form, id],
        queryFn: async () => {
            const response = await genericView(`${CUSTOM_LISTS_SERVICE}/${id}`);
            return await parseCustomListData(response);
        },
        enabled: !!id,
    });

    // Mutación para crear o actualizar la lista personalizada
    const { mutate, isPending } = useGeneralMutation({
        keyQuery: URL_AND_KEYS.customLists.key,
        path: CUSTOM_LISTS_PATH,
    });

    /**
     * Maneja el envío del formulario de lista personalizada.
     * Procesa los valores, construye el payload y ejecuta la mutación.
     *
     * @param {Object} values - Valores del formulario
     * @param {Function} setFormikErrors - Función para establecer errores de Formik
     * @param {Function} setFormikStatus - Función para establecer el estado de Formik
     * @returns {Promise<void>}
     */
    const handleCustomList = async (values, setFormikErrors, setFormikStatus) => {
        // Remueve claves no necesarias del objeto values
        values = removeKey(values, []);

        // Mapea los aux_items al formato esperado por el backend
        const aux_items = values?.aux_items
            ? values.aux_items.map(({ literal, order }) => ({
                  literal,
                  order,
              }))
            : [];

        // Construye el payload con la estructura esperada
        const parseValues = {
            id,
            name: values.name,
            is_active: values.is_active,
            aux_entity: values.aux_entity,
            aux_items,
            groups: values.groups,
        };

        // Prepara los datos para el envío al backend
        const data = genericHandleSendInformation({
            values: parseValues,
            urlService: CUSTOM_LISTS_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
            options: { isCreate: !isEditMode, keepId: !isEditMode },
        });

        // Construye el objeto final con la URL específica según el modo
        const finalData = {
            ...data,
            url: isEditMode ? `${CUSTOM_LISTS_SERVICE}/${id}` : CUSTOM_LISTS_SERVICE,
        };

        // Ejecuta la mutación
        mutate(finalData);
    };

    // Efecto para actualizar el estado local cuando se cargan los datos
    useEffect(() => {
        if (data) {
            setCustomList(data);
        }
    }, [data]);

    // Muestra loader mientras se cargan los datos
    if (isLoading) {
        return <GeneralLoader />;
    }

    return (
        <DashboardSectionCard>
            <CustomListForm
                customList={customList}
                setCustomList={setCustomList}
                handleCustomList={handleCustomList}
                isPending={isPending}
            />
        </DashboardSectionCard>
    );
};

export default CustomListUpdateHandler;
