# Documentación de KaceEngine y Servicios para Scripts de Form.io

Este documento proporciona una guía completa para usar **KaceEngine** y sus servicios dentro de los scripts personalizados de Form.io (por ejemplo, `onMountCode`, `onChangeCode`, `onSubmitCode`).

Estos scripts se ejecutan en un entorno "sandbox" donde usted tiene acceso a variables específicas y a todo el poder del ecosistema de plugins de Kace.

## Entorno y Contexto

Al escribir código personalizado en la configuración de un componente de Form.io, las siguientes variables están disponibles para su script:

- `kaceEngine`: La instancia principal del motor para acceder a los servicios.
- `apiService`: Acceso directo al cliente HTTP (pre-autenticado).
- `url_api`: La URL base de la API.
- `data`: El objeto de datos de la sumisión actual del formulario `{ data: { ... } }`.
- `setData` / `handleChange`: Funciones para actualizar los datos del formulario (disponibles en hooks específicos como `onChange` o `onMount`).

## Acceso a Servicios

Para utilizar cualquier funcionalidad, debe recuperar los servicios a través de `kaceEngine`.

```javascript
// Accediendo a un servicio
var auxService = kaceEngine.getService('aux');
var userService = kaceEngine.getService('user');
```

---

## El Patrón Store y el "Getter Mágico"

La mayoría de los servicios dependen de un **mecanismo de cache** para asegurar el rendimiento. Esto es manejado por `BaseService`, del cual extienden todos los servicios.

### Cómo funciona `service.get('nombrePropiedad')`

Cuando solicita datos usando `get`, el servicio realiza los siguientes pasos automáticamente:

1.  **Revisar Almacenamiento Local:** Busca en el `localStorage` del navegador la clave solicitada.
2.  **Retornar Datos en Caché:** Si existen datos válidos, los retorna inmediatamente (cero latencia de red).
3.  **Obtener y Respaldar:** Si los datos faltan o han expirado:
    *   Llama al método interno `fetch[NombrePropiedad]` (ej. `get('user.user_data')` llama a `fetchUserData()`).
    *   Espera la respuesta de la API.
    *   **Guarda el resultado** en el store automáticamente para futuras llamadas.
    *   Retorna los datos.

**Ejemplo:**
```javascript
// Esta llamada maneja la verificación de cache vs obtención de API automáticamente
var priorities = await auxService.get('priorities');
```

### Servicio Store

También se puede interactuar directamente con el store si se necesita manejar el estado personalizado a través de diferentes ejecuciones de scripts.

```javascript
var store = kaceEngine.getService('store');

// Guardar datos
store.set('mi_dato_personalizado', { foo: 'bar' });

// Recuperar datos
var value = store.get('mi_dato_personalizado');

// Borrar datos específicos para forzar una nueva obtención en el próximo service.get()
store.remove('user.user_data');
```

---

## Servicio API (`api`)

El servicio `api` permite realizar peticiones HTTP crudas. Maneja automáticamente:
- Tokens de autenticación.
- Configuración de la URL base.
- Conceptos básicos de manejo de errores.

### Ejemplos de Métodos HTTP

#### GET (Leer)
```javascript
// Obtener una lista de usuarios activos
var response = await apiService.get('/users?active=true');
// response es el cuerpo JSON retornado por el servidor
```

#### POST (Crear)
```javascript
// Crear una nueva entrada de registro
var payload = {
  action: 'BUTTON_CLICKED',
  timestamp: new Date().toISOString()
};
var result = await apiService.post('/audit/logs', payload);
```

#### PUT (Actualizar)
```javascript
// Actualizar un recurso específico
var caseId = data.data.caseId;
await apiService.put('/cases/' + caseId, { status: 'IN_PROGRESS' });
```

#### DELETE (Eliminar)
```javascript
// Eliminar un documento
await apiService.delete('/documents/' + docId);
```

---

## Lista de Servicios Disponibles

| Nombre del Servicio | Descripción | Ejemplos de Recuperación de Claves |
| :--- | :--- | :--- |
| `aux` | Tablas auxiliares y listas de ayuda | `auxService.get('priorities')`<br>`auxService.get('countries')` |
| `cases` | Lógica de gestión de casos | `caseService.get('case.case_data')` |
| `classifications` | Estructuras de árbol para clasificaciones | `classificationsService.get('tree')` |
| `user` | Sesión/perfil del usuario actual | `userService.get('user.user_data')` |
| `store` | Acceso directo al almacenamiento local | `store.get('clave')`, `store.set('clave', val)` |
| `api` | Cliente HTTP crudo | `api.get()`, `api.post()` |
| `oneScript` | Metodos para obtener la informacion de la definicion de los formularios  | `oneScript.execute(scriptId, params)` |
| `literals` | Literales | `literals.get('common_labels')` |

---

## Ejemplos de Scripts vía Form.io

### Escenario 1: Pre-llenar un formulario al montar (`onMountCode`)

Objetivo: Obtener datos del usuario y poblar un campo cuando el formulario carga.

```javascript
// Este código corre dentro de un wrapper de función asíncrona
try {
  // 1. Obtener el servicio de usuario
  var userService = kaceEngine.getService('user');

  // 2. Obtener datos (usa el getter mágico / caché)
  var userData = await userService.get('user.user_data');

  // 3. Actualizar los datos del formulario
  // 'data' es el objeto de sumisión: { data: { ... } }
  // Lo clonamos para evitar problemas de mutación directa en algunos contextos
  var updatedData = { ...data.data };
  
  updatedData.user_email = userData.email;
  updatedData.full_name = userData.firstName + ' ' + userData.lastName;

  // 4. Confirmar cambios
  // 'setData' permite actualizar la sumisión/estado del formulario
  if (typeof setData === 'function') {
    setData({ data: updatedData });
  }
} catch (err) {
  console.error('Error al pre-llenar formulario:', err);
}
```

### Escenario 2: Lógica Reactiva (`onChangeCode`)

Objetivo: validar si una categoría seleccionada requiere una descripción.

```javascript
// 'data' contiene el estado actual del formulario
var category = data.data.category;
var description = data.data.description;

// Revisar lógica
if (category === 'OTHER' && !description) {
  // Para manipulación de datos:
  var newData = { ...data.data };
  newData.description_required = true; // Campo bandera oculto
  
  if (typeof handleChange === 'function') {
      handleChange({ data: newData });
  }
}
```

### Escenario 3: enviando datos en acciones específicas

Objetivo: Llamar a un webhook externo manualmente usando el servicio API.

```javascript
try {
  var endpoint = '/external/webhook/trigger';
  var payload = {
    formId: data.data.formId,
    submittedBy: kaceEngine.getService('user').get('user.profile').id
  };

  await apiService.post(endpoint, payload);
  console.log('Webhook disparado exitosamente');

} catch (e) {
  console.error('Falló el webhook', e);
}
```
