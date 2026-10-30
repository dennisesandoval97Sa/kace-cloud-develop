import React from 'react';

export const SendStatusAlerts = ({ sendSuccess, sendError }) => (
  <>
    {sendSuccess && (
      <div className="alert alert-success p-2 small mb-2" role="alert">
        <i className="fa fa-check mr-1" /> Correo enviado correctamente.
      </div>
    )}
    {sendError && (
      <div className="alert alert-danger p-2 small mb-2" role="alert">
        <i className="fa fa-exclamation-circle mr-1" /> {sendError}
      </div>
    )}
  </>
);
