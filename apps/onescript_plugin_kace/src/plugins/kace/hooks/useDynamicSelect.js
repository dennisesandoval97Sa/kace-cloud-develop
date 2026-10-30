import { useState, useRef, useCallback } from 'react';
import { KaceEngine } from '../KaceEngine';
import { useLazySelectOptions } from './useLazySelectOptions.hook.js';

/**
 * Select dinámico (API / endpoint). Mantiene `options` en estado local y delega la caché de carga
 * perezosa en {@link useLazySelectOptions} según `component.refetchOnEveryOpen`.
 *
 * @param {{ value: unknown, component: Record<string, unknown>, updateValue: (v: unknown) => void }} param0
 * @returns {{ states: object, actions: object, ensureLoaded: () => void, resetCache: () => void, onExternalDataEvent: () => void, invalidate: () => void }}
 */
const useDynamicSelect = ({ value, component, updateValue }) => {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedValue, setSelectedValue] = useState(
    value !== null && value !== undefined ? String(value) : ''
  );
  const isInternalChange = useRef(false);
  /** Tras un error, el siguiente GET fuerza caché HTTP aunque `refetchOnEveryOpen` esté en false. */
  const hadFetchErrorRef = useRef(false);

  const kaceEngine = KaceEngine();

  const cleanLabel = (text) => {
    let cleaned = text.replace('/list', '');

    cleaned = cleaned.replace('/', '');

    if (cleaned === 'customlists') {
      cleaned = 'custom list';
    }

    return cleaned;
  };

  const handleChange = useCallback(
    (event) => {
      const newValue = event.target.value;
      isInternalChange.current = true;
      setSelectedValue(newValue);
      updateValue(newValue);
    },
    [updateValue]
  );

  const buildEndpoint = (config) => {
    const { endpoint, literal_id, entity, field, list_id } = config;

    // Si no hay endpoint configurado
    if (!endpoint) {
      return null;
    }

    // Endpoint de literals con ID dinámico
    if (endpoint === '/literals' && literal_id) {
      return `/literals/${literal_id}/list`;
    }

    if (endpoint === '/customlists' && list_id) {
      return `/customlists/${list_id}`;
    }

    // Endpoint de auxiliaries con entity dinámica con path
    if (endpoint === '/auxiliaries' && entity && field) {
      return `/auxiliaries/${entity}/list?field=${field}`;
    }

    // Endpoint de auxiliaries con entity dinámica
    if (endpoint === '/auxiliaries' && entity) {
      return `/auxiliaries/${entity}/list`;
    }

    // Endpoint estático predefinido
    return endpoint;
  };

  const extractItems = (data) => {
    if (!data) {
      return [];
    }

    // Si es un array directamente
    if (Array.isArray(data)) {
      return data;
    }

    if (data && Array.isArray(data.data)) {
      return data.data;
    }

    // Si tiene estructura { data: { items: [...] } }
    if (data.data?.items && Array.isArray(data.data.items)) {
      return data.data.items;
    }

    // Si tiene estructura { items: [...] }
    if (data.items && Array.isArray(data.items)) {
      return data.items;
    }

    if (Array.isArray(data?.data?.aux_items)) {
      return data.data.aux_items.map((auxItem, index) => ({
        id: auxItem.literal ?? auxItem.name,
        name: auxItem.literal ?? auxItem.name,
      }));
    }

    return [];
  };

  const refetchOnEveryOpen = Boolean(component?.refetchOnEveryOpen);

  const mapItemToOption = (item, labelField, valueField) => {
    // Handle primitive values (string, number, boolean)
    if (item === null || item === undefined) {
      return { label: '', value: '' };
    }
    if (typeof item !== 'object') {
      const primitive = String(item);
      return { label: primitive, value: primitive };
    }

    const label =
      item[labelField] ||
      item.name ||
      item.label ||
      item.title ||
      item.nombre ||
      JSON.stringify(item);

    const rawValue =
      item[valueField] || item.id || item.value || item[labelField] || label;

    const value =
      rawValue !== null && rawValue !== undefined ? String(rawValue) : '';

    return { label, value };
  };

  const fetchData = useCallback(async () => {
    const endpoint = buildEndpoint({
      endpoint: component.endpoint,
      literal_id: component.literal_id,
      entity: component.entity,
      field: component.field,
      list_id: component.list_id,
    });

    if (!endpoint) {
      setError('No se ha configurado ningún punto final válido');
      setOptions([]);
      const err = new Error('No se ha configurado ningún punto final válido');
      throw err;
    }

    setLoading(true);
    setError(null);

    try {
      const apiService = kaceEngine.getService('apiService');
      const getConfig =
        refetchOnEveryOpen || hadFetchErrorRef.current
          ? { __kaceForceRefresh: true }
          : {};
      const data = await apiService.get(endpoint, getConfig);

      let items = extractItems(data?.data);

      if (items.length === 0) {
        setOptions([]);
        hadFetchErrorRef.current = false;
        return;
      }

      // Mapear items a opciones del select
      const labelField = component.labelField || 'name';
      const valueField = component.valueField || 'id';

      const mappedOptions = items.map((item) =>
        mapItemToOption(item, labelField, valueField)
      );

      setOptions(mappedOptions);
      hadFetchErrorRef.current = false;
    } catch (err) {
      hadFetchErrorRef.current = true;
      setError(err.message || 'Error al obtener datos de la API');
      setOptions([]);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [
    refetchOnEveryOpen,
    component.endpoint,
    component.literal_id,
    component.entity,
    component.labelField,
    component.valueField,
    component.field,
    component.list_id,
  ]);
  const { ensureLoaded, resetCache, onExternalDataEvent, invalidate } =
    useLazySelectOptions({
      refetchOnEveryOpen,
      loadFn: fetchData,
    });

  const states = {
    options,
    loading,
    error,
    selectedValue,
    isInternalChange,
  };

  const actions = {
    cleanLabel,
    fetchData,
    handleChange,
    setSelectedValue,
  };

  return {
    states,
    actions,
    ensureLoaded,
    resetCache,
    onExternalDataEvent,
    invalidate,
  };
};

export default useDynamicSelect;
