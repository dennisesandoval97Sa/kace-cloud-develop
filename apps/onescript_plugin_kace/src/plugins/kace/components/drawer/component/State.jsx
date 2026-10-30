import { useId, useState } from 'react';
import { FormUpdateState } from './FormUpdateState';
import { SuccessMessage } from './SuccessMessage';
import { storeService } from '#plugins/kace/services/storeService.js';
import { postMessageToParent } from '#plugins/kace/shared/postMessageToParent.util.js';

export const State = ({
  caseStates,
  onStateChange,
  toggleOpen,
  disabled = false,
}) => {
  const estadoActualId = useId();
  const estadoSiguienteId = useId();
  const [selectedTransitionId, setSelectedTransitionId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [newStateName, setNewStateName] = useState('');

  const case_id = storeService.get('cases.case_id');

  if (!caseStates || caseStates.length === 0) {
    return null;
  }

  const estadoActual = caseStates[0]?.estado_actual;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (disabled) return;

    if (!selectedTransitionId) {
      setError('Por favor seleccione un estado');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      // Buscar el nombre del nuevo estado seleccionado
      const selectedState = caseStates.find(
        (item) => item?.transition?.id === selectedTransitionId
      );
      const newStateNameValue = selectedState?.estado_siguiente?.nombre || '';
      await onStateChange(selectedTransitionId);

      // Mostrar mensaje de éxito
      setNewStateName(newStateNameValue);
      setShowSuccess(true);
      if (case_id) {
        postMessageToParent({
          route: `/agent/update/${case_id}?action=edit`,
        });
      }
    } catch (err) {
      setError(
        err.message ||
          'Error al cambiar el estado del caso. Por favor intente nuevamente.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // Si la actualización fue exitosa, mostrar mensaje de éxito
  if (showSuccess) {
    return (
      <SuccessMessage toggleOpen={toggleOpen} newStateName={newStateName} />
    );
  }

  return (
    <div className="kace-drawer-state-modal">
      <div className="kace-drawer-state-content">
        <FormUpdateState
          estadoActualId={estadoActualId}
          estadoSiguienteId={estadoSiguienteId}
          estadoActual={estadoActual}
          handleSubmit={handleSubmit}
          caseStates={caseStates}
          selectedTransitionId={selectedTransitionId}
          setSelectedTransitionId={setSelectedTransitionId}
          error={error}
          setError={setError}
          isSubmitting={isSubmitting}
          toggleOpen={toggleOpen}
          disabled={disabled}
        />
      </div>
    </div>
  );
};
