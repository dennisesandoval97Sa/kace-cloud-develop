import { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';

const TIMEOUT_MS = 10000;

export function useInitHandshake() {
  const requestIdRef = useRef(uuidv4());
  const [state, setState] = useState({
    data: null,
    error: null,
    pending: true,
  });

  useEffect(() => {
    const requestId = requestIdRef.current;

    window.parent.postMessage({ type: 'KACE_INIT_REQUEST', requestId }, '*');

    const timer = setTimeout(() => {
      setState({ data: null, error: new Error('timeout'), pending: false });
    }, TIMEOUT_MS);

    function handler(event) {
      if (event.data?.type !== 'KACE_INIT_RESPONSE') return;
      if (event.data?.requestId !== requestId) return;

      clearTimeout(timer);
      window.removeEventListener('message', handler);
      setState({ data: event.data, error: null, pending: false });
    }

    window.addEventListener('message', handler);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('message', handler);
    };
  }, []);

  return state;
}
