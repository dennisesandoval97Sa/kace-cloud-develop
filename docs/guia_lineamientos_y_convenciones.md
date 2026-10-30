**Guía Completa de Lineamientos y Convenciones para el Equipo de Desarrollo de Software**

---

### **1\. Introducción**

Esta guía establece los lineamientos, convenciones y buenas prácticas que seguirá el equipo de desarrollo. Su objetivo es garantizar calidad, escalabilidad y colaboración en los proyectos de software. El stack tecnológico incluye:

* **Lenguaje principal:** JavaScript (ES6 o superior).  
* **Frontend:** React (Single Page Applications \- SPA).  
* **Backend:** Node.js con AWS Lambdas.

El desarrollo adoptará **TDD (Test-Driven Development)**, **DDD (Domain-Driven Design)** y la **arquitectura hexagonal** como pilares metodológicos.

### 

### **2\. Principios Fundamentales del Desarrollo**

#### **2.1 Principios SOLID**

1. **Single Responsibility Principle (SRP):** Cada módulo o clase debe tener una única razón para cambiar.  
2. **Open/Closed Principle (OCP):** El código debe estar abierto para extensiones, pero cerrado para modificaciones.  
3. **Liskov Substitution Principle (LSP):** Los objetos de una subclase deben ser sustituibles por objetos de su superclase.  
4. **Interface Segregation Principle (ISP):** No forzar a las clases a implementar interfaces que no utilizan.  
5. **Dependency Inversion Principle (DIP):** Depender de abstracciones, no de implementaciones concretas.

#### **2.2 Otros principios clave**

* **DRY (Don’t Repeat Yourself):** Evitar la duplicación de código reutilizando componentes y funciones.  
* **KISS (Keep It Simple, Stupid):** Diseñar soluciones simples y directas.  
* **YAGNI (You Aren’t Gonna Need It):** No implementar funcionalidades que no sean necesarias actualmente.  
* **TDA (Tell, Don’t Ask):** Diseñar objetos que realicen acciones en lugar de exponer sus datos.  
* **Fail Fast:** Detectar errores lo antes posible para minimizar su impacto.  
* **Composition Over Inheritance:** Priorizar la composición sobre la herencia para mejorar la flexibilidad y reutilización del código.  
* **LOD (Law of Demeter):** Respetar el principio de mínima comunicación, accediendo sólo a objetos directamente relacionados.

### 

### **3\. Guía Breve de Estilo**

Usaremos **Prettier** para formatear el código de forma automática y asegurar consistencia en el estilo, complementado con **ESLint** para identificar y corregir errores o inconsistencias en el código.

#### **3.1 Estilo de Código**

1. **Uso de ES6+:**  
   * Preferir `let` y `const` en lugar de `var`.  
   * Uso de arrow functions (`=>`) para funciones anónimas.  
   * Template literals (```\``) en lugar de concatenación con``` \+\`.  
2. **Indentación:** 4 espacios por nivel de anidación.  
3. **Nombres:**  
   * Variables y funciones: camelCase.  
   * Clases y componentes React: PascalCase.  
   * Constantes: SNAKE\_CASE.  
4. **Código modular:** Exportar una única clase o función por archivo cuando sea posible.

### 

### **4\. Estructura de Carpetas**

### **Arquitectura Hexagonal \+ Vertical Slicing \+ Screaming**

En el contexto de estructura de directorios, estas aproximaciones promueven un diseño modular, enfocado en la funcionalidad y la claridad:

#### **Estructura Propuesta:**

* **Arquitectura Hexagonal:**

  * Cada módulo debe dividirse en capas claras:  
    * **Application:** Casos de uso, lógica de aplicación y coordinadores.  
    * **Domain:** Reglas de negocio, validadores y objetos de valor.  
    * **Infrastructure:** Adaptadores, persistencia y servicios externos.  
* **Vertical Slicing:**

  * Cada módulo corresponde a una funcionalidad específica del sistema.  
  * Ejemplo:

```
├── actions
│   ├── application
│   │   ├── create
│   │   ├── delete
│   │   ├── find
│   │   └── update
│   ├── domain
│   │   ├── value_objects
│   └── infrastructure
│       └── persistence
├── auth
│   ├── application
│   │   └── authenticate
│   ├── domain
│   └── infrastructure
│       └── external-services
```

* **Screaming Architecture:**  
  * Los nombres de directorios y archivos deben reflejar el dominio y no los patrones técnicos.  
  * Esto ayuda a identificar rápidamente la funcionalidad de cada módulo.

Con esta combinación, se logra un sistema que es fácil de entender, mantener y escalar.

### **5\. Desarrollo Basado en TDD**

1. Escribir primero las pruebas para definir el comportamiento esperado.  
2. Ejecutar las pruebas y asegurarse de que fallen (Red).  
3. Implementar la funcionalidad hasta que las pruebas pasen (Green).  
4. Refactorizar el código manteniendo las pruebas en verde.

#### **Herramientas sugeridas:**

* **Jest** para integración y unitarias.  
* **Cypress** para pruebas end-to-end.

---

### **6\. Diseño Dirigido por el Dominio (DDD)**

1. **Contextos delimitados:** Identificar módulos funcionales claros y autónomos.  
2. **Modelo del dominio:** Crear objetos que reflejan el negocio.  
3. **Lenguaje ubicuo:** Adoptar un vocabulario común entre desarrolladores y partes interesadas.  
4. **Eventos de dominio:** Usar eventos para comunicar cambios entre contextos.

---

### **7\. Arquitectura Hexagonal**

1. Dividir la aplicación en:  
   * **Capa de dominio:** Lógica de negocio pura.  
   * **Adaptadores:** Interfaces para entradas (API, UI) y salidas (bases de datos, servicios externos).  
   * **Aplicación:** Coordinador entre dominio y adaptadores.  
2. **Inversión de dependencias:** El dominio nunca debe depender de adaptadores concretos.  
3. Seguir patrones como **repositorios**, **factories** y **servicios** para desacoplar lógicas.

---

### **8\. Mantenimiento y Documentación**

* **Comentarios:** Documentar solo cuando el código no sea autoexplicativo.  
* **Documentación externa:** Usar herramientas como JSDoc para generar documentación automática.  
* **Revisiones de código:** Adoptar revisiones de pull requests como parte del flujo de trabajo.

**Siguiendo estas directrices, el equipo garantizará un desarrollo ágil, estructurado y con altos estándares de calidad.**

