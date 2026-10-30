import { useCallback, useEffect } from 'react';
import { postMessageToParent } from '#plugins/kace/shared/postMessageToParent.util.js';

const POST_MESSAGE_TYPE_AUTH_INTERACTION = 'KACE_ONE_SCRIPT_INTERACTION';

/**
 * Subscribes to document-level click and keydown events and sends a postMessage to the parent
 * on each interaction. Used when Auth runs inside an iframe so the host can track activity.
 *
 * @returns {void}
 */
export function useAuthInteractionReporter() {
  const reportInteraction = useCallback((eventType) => {
    try {
      postMessageToParent({
        type: POST_MESSAGE_TYPE_AUTH_INTERACTION,
        eventType,
      });
    } catch (err) {
      console.warn('[Kace] useAuthInteractionReporter:', err?.message ?? err);
    }
  }, []);

  useEffect(() => {
    const handleClick = () => reportInteraction('click');
    const handleKeydown = () => reportInteraction('keydown');

    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeydown);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeydown);
    };
  }, [reportInteraction]);
}
