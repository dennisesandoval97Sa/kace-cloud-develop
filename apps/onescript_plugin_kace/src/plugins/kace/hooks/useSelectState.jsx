import { useState } from 'react';

/**
 * Hook personalizado para manejar el estado de un select individual
 * @param {string} initialValue - Valor inicial del select
 */
export const useSelectState = (initialValue = '') => {
  const [options, setOptions] = useState([]);
  const [value, setValue] = useState(initialValue);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [customIdSelected, setCustomIdSelected] = useState('');

  return {
    options,
    setOptions,
    value,
    setValue,
    loading,
    setLoading,
    error,
    setError,
    customIdSelected,
    setCustomIdSelected,
  };
};
