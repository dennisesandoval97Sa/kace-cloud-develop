# Guía funcional — Generador de folios / radicados

Esta guía explica, sin entrar en detalles técnicos, qué es un folio, cómo se arma desde la
pantalla y qué reglas conviene tener presentes antes de configurarlo.

---

## 1. Qué es un folio

Un **folio** (o **radicado**) es un código que identifica un caso ante el cliente, la entidad de
control o el usuario final. A diferencia de un identificador interno, el folio tiene una **forma
pactada**: por ejemplo, primero un dígito que identifica al producto, luego el año, luego el canal
por el que entró y al final un número que va subiendo caso a caso.

El generador permite armar esa forma **pieza por pieza**, sin tocar código y sin que Desarrollo
tenga que intervenir cuando otro cliente pide otra estructura.

### Los tres códigos que conviven en un caso

Los tres aparecen en pantalla, así que conviene no confundirlos:

| Código | Qué es | Quién lo pone |
| --- | --- | --- |
| **Consecutivo** (`reference`) | Número corrido global de la plataforma. Existe siempre, en todos los casos. | Lo genera la base de datos automáticamente. Nadie lo configura. |
| **Código externo** (`external_code`) | Código que viene de un sistema externo o que se captura manualmente. Puede llevar un folio corto añadido si el tenant lo activó en la configuración general. | El usuario o la integración. |
| **Folio / radicado** (`folio`) | El código configurable que describe esta guía. | Lo genera el sistema, **solo** si la clasificación del caso tiene una configuración asociada. |

Los tres son independientes. Activar el folio **no cambia ni reemplaza** el Consecutivo ni el
Código externo: se suma a ellos. En el título del caso se muestra el código externo y, si el caso no
lo tiene, el folio.

---

## 2. Cómo se arma un folio

Un folio es una **fila de piezas** que se concatenan de izquierda a derecha. El orden en que
aparecen en la pantalla es exactamente el orden en que salen en el código.

Hay cuatro tipos de pieza:

| Pieza | Para qué sirve | Qué se le configura |
| --- | --- | --- |
| **Texto fijo** | Meter caracteres que nunca cambian: un prefijo de producto, un guion, unas siglas. | El texto (hasta 50 caracteres). |
| **Fecha** | Estampar el momento de creación del caso. | El formato: año completo (`YYYY` → `2026`), dos últimos dígitos del año (`YY` → `26`), año y mes (`YYMM` → `2610`), fecha completa (`YYYYMMDD`), mes, día, hora, minutos o segundos. |
| **Campo del caso** | Traer un dato del caso o de su formulario auxiliar: el canal, la ciudad, el tipo de solicitud. | El origen (Caso o Auxiliar del caso) y el campo concreto. |
| **Consecutivo** | El número que sube solo con cada caso. | Cuántos dígitos ocupa (de 1 a 9) y con qué carácter se rellena (normalmente `0`). |

**Solo puede haber un consecutivo** por configuración. El resto de piezas se pueden repetir.

### Por qué la lista de formatos de fecha es cerrada

El desplegable ofrece 14 formatos y no deja escribir uno libre. Un formato escrito a mano puede colar
texto entre comillas y cambiar el ancho del folio sin que nadie lo note. Los formatos `M` y `D` (mes
y día sin cero delante) existen, pero hacen que el folio cambie de ancho según la fecha. Para que
los folios queden alineados conviene usar `MM` y `DD`.

---

## 3. El ejemplo, pieza por pieza

Estructura pedida: un `5` fijo, luego el año en dos dígitos, luego el canal del auxiliar y, al final,
un consecutivo de 9 dígitos que arranca en 50.

| Orden | Pieza | Configuración | Resultado |
| --- | --- | --- | --- |
| 1 | Texto fijo | `5` | `5` |
| 2 | Fecha | formato `YY` | `26` |
| 3 | Campo del caso | Auxiliar → `canal` | `1` (el valor que tenga el caso) |
| 4 | Consecutivo | 9 dígitos, relleno `0`, inicio en 50 | `000000050` |

Folio resultante: **`5261000000050`**

Y así evoluciona a medida que se crean casos:

| Nº de caso | Consecutivo | Folio |
| --- | --- | --- |
| 1.º | 50 | `5261000000050` |
| 2.º | 51 | `5261000000051` |
| 51.º | 100 | `5261000000100` |
| … | 999 999 999 | `5261999999999` |

El ancho **nunca cambia**: al pasar de 99 a 100 el consecutivo se come un cero del relleno, de modo
que el folio siempre mide lo mismo. Eso es lo que permite ordenarlos, buscarlos por rango y
alinearlos en un reporte.

> El campo se copia tal cual. Si el auxiliar guarda `Petición`, el folio llevará `Petición`, no un
> código. Para un folio numérico, el campo del auxiliar debe guardar ya el código.

---

## 4. Paso a paso en la pantalla

El módulo está en el menú lateral como **Configuración de Folios** (`/folio-configurations`).
Requiere el permiso de lectura del módulo; crear, editar y eliminar tienen sus propios permisos. El
rol administrador los recibe todos, tanto en tenants nuevos como en los existentes (al desplegar se
conceden a los roles con acceso de administrador, sin tocar los que ya se hayan denegado a mano).

### 4.1 Crear la configuración

1. Pulse **Nuevo** para abrir el formulario.
2. **Información**: nombre de la configuración (obligatorio, único y de al menos 3 caracteres) y
   descripción.
3. **Consecutivo**:
   - **Número inicial**: desde qué número arranca. En el ejemplo, `50`.
   - **Reinicio del consecutivo**: cuándo vuelve a empezar (ver 4.4).
   - **Si se desborda el ancho**: qué hacer si el número ya no cabe (ver 4.5).
4. **Estructura del folio**: pulse **Añadir segmento** tantas veces como piezas necesite, elija el
   tipo de cada una y ordénelas con las flechas ↑ ↓. La papelera elimina una pieza.
5. **Vista previa**: debajo de la lista se va calculando cómo quedaría el folio.
6. Pulse **Guardar**.

### 4.2 Cómo leer la vista previa

- **No consume consecutivo.** Puede abrirla y recargarla las veces que quiera: solo *lee* el
  contador y muestra cuál sería el siguiente número.
- **Al editar una configuración que ya está en uso, muestra el siguiente folio real** de su
  contador (por ejemplo `RAD-0004` si ya se emitieron tres). En una configuración nueva muestra el
  número inicial.
- Las piezas de tipo *Campo del caso* aparecen como un marcador entre comillas angulares: `‹canal›`.
  Es normal, porque ese dato solo existe cuando hay un caso real.
- Si la estructura no es válida (un formato no permitido, una pieza sin llenar o alguna de las reglas
  de la sección 5), la vista previa muestra el motivo indicando qué pieza lo causa.

### 4.3 Asociar clasificaciones

Una configuración solo empieza a generar folios cuando está asociada a al menos una clasificación.
La asociación se hace **desde la clasificación**: en su formulario, sección *Configuración de
folio*, elija la configuración en el desplegable. Solo aparecen las configuraciones **activas**, y
el sistema no deja guardar una configuración que no exista o que se haya eliminado.

Al editar una configuración ya guardada, la sección *Clasificaciones asociadas* muestra qué
clasificaciones la usan. Es **solo de consulta**: para cambiarlas, edite cada clasificación.

Una configuración puede estar en **muchas clasificaciones**; una clasificación tiene **una sola**
configuración.

### 4.4 Reinicio del consecutivo

Define cada cuánto vuelve a arrancar la numeración:

| Opción | Comportamiento | Requisito |
| --- | --- | --- |
| **Nunca** | Un único contador que crece indefinidamente. | — |
| **Anual** | Vuelve al número inicial el 1 de enero. Cada año lleva su propia cuenta. | El folio debe llevar el **año**. |
| **Mensual** | Vuelve al número inicial el día 1 de cada mes. | El folio debe llevar **año y mes**. |
| **Diario** | Vuelve al número inicial cada día. | El folio debe llevar **año, mes y día**. |
| **Por prefijo generado** | Lleva un contador distinto por cada valor que produzcan las piezas que van **antes** del consecutivo. | Debe haber al menos una pieza antes del consecutivo. |

El requisito de fecha no es un capricho. Si el contador vuelve a empezar y el folio no lleva la
fecha, los folios del año nuevo serían idénticos a los del anterior. Por eso la fecha debe ir en una
posición fija: al principio o al final del folio, o separada del extremo solo por textos fijos y
otras fechas, nunca con un campo de por medio.

**Por prefijo generado** es la opción más potente: si el folio ya lleva delante el año y el canal,
cada combinación de año y canal tendrá su propia numeración, sin configurar nada más.

> Con reinicio anual, mensual o diario, la fecha del contador y la de la pieza *Fecha* usan el mismo
> reloj y la misma zona horaria del tenant, así que nunca se contradicen en el cambio de año.

### 4.5 Si se desborda el ancho

Qué hacer cuando el número deja de caber en los dígitos configurados (por ejemplo, llegar a
1 000 000 con un consecutivo de 6 dígitos):

| Opción | Comportamiento |
| --- | --- |
| **Bloquear la creación del caso** | El caso no se crea y se muestra un error pidiendo ampliar el ancho o configurar un reinicio. |
| **Alargar el folio** | El folio crece un carácter y los casos siguen creándose. Exige que el consecutivo quede separado de los campos por un texto fijo que no sea un número (ver sección 5). |

**En ningún caso se recorta el número.** Recortar dígitos produciría dos casos con el mismo folio.

---

## 5. Reglas que el sistema aplica al guardar

El sistema rechaza, con un mensaje que indica la pieza afectada, las estructuras que podrían
repetir un folio:

- **A un lado del consecutivo solo puede haber textos fijos y fechas.** Si hay campos del caso a
  ambos lados, un número y otro podrían confundirse. Ejemplo válido: `RAD-` + canal + `-` +
  consecutivo. Ejemplo rechazado: canal + consecutivo + ciudad.
- **El relleno del consecutivo no puede ser un número del 1 al 9.** Con relleno `9`, el número 5 y
  el 9995 se verían iguales (`9995`). Use `0` u otro carácter.
- **El consecutivo admite como máximo 9 dígitos**, y el número inicial debe caber en ellos.
- **Un reinicio exige la fecha correspondiente**, en una posición fija (ver 4.4).
- **No puede haber dos configuraciones que puedan producir el mismo folio.** Con contadores
  independientes emitirían los mismos radicados. No hace falta que sean idénticas: `RAD-` + 4 dígitos
  y `RAD-0` + 3 dígitos, o *Año* + `-` y el texto fijo `2026-`, también se rechazan. La comparación
  incluye las configuraciones desactivadas o eliminadas que ya emitieron folios, porque sus números
  ya están entregados. Añada un texto fijo que las distinga.
- **Los campos solo pueden venir del Caso o de su Auxiliar** (la API admite también los niveles de
  la Clasificación). Los datos del cliente o del estado no están disponibles al crear el caso.

---

## 6. Reglas de funcionamiento

- **Un caso nunca cambia de folio.** Si un caso ya tiene folio y se reclasifica, conserva el suyo.
  Si *no* tenía y pasa a una clasificación configurada, recibe el de esa nueva clasificación en ese
  momento. Esto vale tanto para la reclasificación desde el caso como para la edición del auxiliar.
  En la edición del auxiliar, si el folio usa un campo del auxiliar, se toma el valor que se está
  guardando en esa misma edición, no el anterior.
- **Los casos clonados reciben su propio folio.** El clon no hereda el del original: recibe uno
  nuevo de su clasificación, o ninguno si su clasificación no tiene configuración.
- **Una configuración desactivada deja de generar.** Los casos nuevos de sus clasificaciones se crean
  sin folio. Los folios ya emitidos no se tocan.
- **No se puede eliminar una configuración asociada a clasificaciones.** Hay que desasociarlas
  primero, para que ninguna clasificación deje de emitir radicado sin que nadie se entere.
- **Una vez emitido el primer folio no se puede:**
  - cambiar el número inicial, porque el contador ya va por donde va. Si necesita otra numeración,
    cree una configuración nueva;
  - cambiar el reinicio del consecutivo, porque la numeración volvería a empezar y repetiría
    radicados;
  - cambiar la estructura del folio (textos, fechas, campos o relleno). Lo único permitido es
    **ampliar el ancho del consecutivo**. Para otro formato, cree una configuración nueva.
- **El folio no se puede escribir a mano.** No es un campo del formulario del caso: lo pone el
  sistema.

---

## 7. Qué pasa si algo falla al crear un caso

El folio se calcula **antes** de tocar el contador, así que un error de configuración **no gasta
números**.

| Situación | Qué ocurre |
| --- | --- |
| La clasificación no tiene configuración | El caso se crea normalmente, sin folio. No es un error. |
| La configuración está desactivada | Igual: el caso se crea sin folio. |
| Una pieza *Campo del caso* apunta a un campo que viene vacío | **El caso no se crea.** El mensaje indica qué pieza y qué ruta fallaron: emitir un radicado incompleto es peor que no emitirlo. |
| El folio completo superaría los 100 caracteres | El caso no se crea y no se gasta número. |
| El consecutivo desbordó el ancho y la opción es *Bloquear* | El caso no se crea; el mensaje pide ampliar el ancho o configurar un reinicio. |
| El folio calculado ya existe en otro caso | El sistema salta los números cuyo folio ya existe y usa el siguiente libre. El caso se crea. No quedan huecos: solo se saltan números que ya están en otro caso, y el salto se conserva aunque la creación falle después. |
| Dos casos entran exactamente al mismo tiempo | Ambos se crean con números distintos. El sistema los ordena (ver [preguntas frecuentes](preguntas-frecuentes.md#p4)). |
| Contención sostenida sobre el mismo contador | Tras 3 segundos de espera se responde *«El folio está en contención, reintente la operación»*. Reintentar lo resuelve. |

---

## 8. Recomendaciones al diseñar un folio

- **Ponga siempre algo que distinga cada configuración**, como un prefijo o unas siglas. El sistema
  rechaza las estructuras que pueden coincidir, pero cuando hay campos del caso solo detecta las
  idénticas. Si dos estructuras con campos coinciden en algún folio, se salta ese número, y es
  mejor no llegar ahí.
- **Piense el ancho del consecutivo con holgura.** Estime el volumen anual y añada margen: es el
  parámetro más caro de cambiar después.
- **Prefiera un reinicio (anual o por prefijo) a un consecutivo muy largo.** Mantiene los códigos
  cortos y legibles.
- **Verifique en la vista previa antes de asociar clasificaciones.** Una vez emitido el primer folio,
  el número inicial, el reinicio y la estructura quedan congelados; solo se puede ampliar el
  consecutivo.
