export const EVALUATOR_HANDSHAKE_PARAMS_DOC_ROW =
  '<tr><td><span style="font-family: monospace; font-weight: bold;">params</span></td><td>Parámetros del handshake de Auth (<code>refresh_token</code>, <code>case_id</code>, <code>user_id</code>, <code>url_api</code>, etc.). <code>null</code> hasta completar la autenticación.</td></tr>';

export const EVALUATOR_AUTH_COGNITO_RESPONSE_DOC_ROW =
  '<tr><td><span style="font-family: monospace; font-weight: bold;">authCognitoResponse</span></td><td>Respuesta de <code>/auth-cognito</code> del handshake de Auth (usuario, grupos, permisos). <code>null</code> hasta completar la autenticación.</td></tr>';

export const EVALUATOR_HANDSHAKE_PARAMS_DOC_ROW_SCHEMA =
  '<tr><td><span style="font-family: monospace; color: #212529; font-weight: bold;">params</span></td><td>Parámetros del handshake de Auth (<code>refresh_token</code>, <code>case_id</code>, <code>user_id</code>, <code>url_api</code>, etc.). <code>null</code> hasta completar la autenticación.</td></tr>';

export const EVALUATOR_AUTH_COGNITO_RESPONSE_DOC_ROW_SCHEMA =
  '<tr><td><span style="font-family: monospace; color: #212529; font-weight: bold;">authCognitoResponse</span></td><td>Respuesta de <code>/auth-cognito</code> del handshake de Auth (usuario, grupos, permisos). <code>null</code> hasta completar la autenticación.</td></tr>';

export const EVALUATOR_HANDSHAKE_DOC_ROWS =
  EVALUATOR_HANDSHAKE_PARAMS_DOC_ROW + EVALUATOR_AUTH_COGNITO_RESPONSE_DOC_ROW;

export const EVALUATOR_HANDSHAKE_DOC_ROWS_SCHEMA =
  EVALUATOR_HANDSHAKE_PARAMS_DOC_ROW_SCHEMA +
  EVALUATOR_AUTH_COGNITO_RESPONSE_DOC_ROW_SCHEMA;
