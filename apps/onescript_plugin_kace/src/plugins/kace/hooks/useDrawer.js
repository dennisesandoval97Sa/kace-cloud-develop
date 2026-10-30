import { useCallback, useRef, useState } from 'react';
import { KaceEngine } from '../KaceEngine';

const useDrawer = () => {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [data, setData] = useState([]);
  const [isDrawerVisible, setIsDrawerVisible] = useState(false);
  const [caseStates, setCaseStates] = useState([]);
  const [users, setUsers] = useState([]);
  const [caseData, setCaseData] = useState({});
  const requestedIds = useRef(new Set());

  const kaceEngine = KaceEngine();
  const caseService = kaceEngine.getService('cases');
  const userService = kaceEngine.getService('user');

  const updateState = useCallback(async (transition_id) => {
    try {
      setIsLoading(true);
      const response = await caseService.updateState({ transition_id });
      return response;
    } catch (err) {
      throw new Error(
        'Error al cambiar el estado del caso. No cumplen las reglas para realizar el cambio de estado.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getData = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await caseService.getTransitionsData();
      setData(response);
    } catch (err) {
      throw new Error(
        'Error al obtener los datos de los estados. Por favor intente nuevamente.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getCaseStates = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await caseService.getCaseAvailableStates();
      setCaseStates(response);
    } catch (error) {
      throw new Error(
        'Error al obtener los estados del caso. Por favor intente nuevamente.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getCaseData = useCallback(async () => {
    try {
      setIsLoading(true);

      const storeService = kaceEngine.getService('storeService');
      const caseData = storeService.get('cases.case_data');

      if (caseData) {
        setCaseData(caseData);
      }
    } catch (error) {
      //ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  const toggleOpen = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const toggleDrawerVisibility = useCallback(() => {
    setIsDrawerVisible((prev) => !prev);
  }, []);

  const getUser = useCallback(
    async (actualizador) => {
      if (requestedIds.current.has(actualizador)) return;
      requestedIds.current.add(actualizador);
      try {
        setIsLoading(true);
        const response = await userService.searchUsers({
          filter: [
            {
              field: 'login',
              operator: 'eq',
              value: actualizador,
              type: 'AND',
            },
          ],
          limit: 1,
          offset: 0,
        });

        if (response.length > 0) {
          setUsers((prev) => {
            const map = new Map(prev.map((u) => [u.login, u]));
            response.forEach((u) => map.set(u.login, u));
            return [...map.values()];
          });
        }
      } catch (error) {
        //ignore
      } finally {
        setIsLoading(false);
      }
    },
    [userService]
  );

  const state = {
    isMinimized,
    isOpen,
    data,
    caseStates,
    isLoading,
    isDrawerVisible,
    users,
    caseData,
  };

  const actions = {
    getData,
    getCaseStates,
    toggleMinimize,
    toggleOpen,
    toggleDrawerVisibility,
    updateState,
    getUser,
    getCaseData,
  };

  return { state, actions };
};

export default useDrawer;
