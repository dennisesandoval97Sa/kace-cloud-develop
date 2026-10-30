# Documentación del Frontend (kace-saas)

Aplicación React SPA para la plataforma KACE Cloud.

## Índice

1. [Stack Tecnológico](#stack-tecnológico)
2. [Estructura del Proyecto](#estructura-del-proyecto)
3. [Arquitectura](#arquitectura)
4. [Componentes](#componentes)
5. [Estado y Data Fetching](#estado-y-data-fetching)
6. [Routing](#routing)
7. [Autenticación](#autenticación)
8. [Estilos](#estilos)
9. [Internacionalización](#internacionalización)
10. [Testing](#testing)
11. [Scripts de Desarrollo](#scripts-de-desarrollo)

---

## Stack Tecnológico

| Categoría        | Tecnología      | Versión |
|------------------|-----------------|---------|
| Framework        | React           | 18.3.1  |
| State Management | Redux Toolkit   | 2.3.0   |
| Server State     | TanStack Query  | 5.59.15 |
| Routing          | React Router    | 6.27.0  |
| Bundler          | Vite            | 6.2.4   |
| Styling          | Tailwind CSS    | 3.4.14  |
| UI Components    | Radix UI        | Latest  |
| Forms            | React Hook Form | 7.52.2  |
| Validation       | Joi             | 17.13.3 |
| HTTP Client      | Axios           | 1.7.7   |
| i18n             | i18next         | 23.11.5 |
| Testing          | Vitest          | 3.1.3   |

---

## Estructura del Proyecto

```
apps/kace-saas/
├── src/
│   ├── main.jsx                 # Entry point
│   ├── App.jsx                  # Root component
│   ├── index.css                # Global styles
│   │
│   ├── pages/                   # Feature pages (50+ módulos)
│   │   ├── Dashboard/
│   │   ├── Cases/
│   │   ├── Clients/
│   │   ├── Users/
│   │   └── ...
│   │
│   ├── components/              # Componentes reutilizables
│   │   ├── core/               # Componentes core (29+)
│   │   │   ├── Card/
│   │   │   ├── DataTable/
│   │   │   ├── Modal/
│   │   │   └── ...
│   │   ├── layouts/            # Layouts
│   │   │   ├── MainLayout.jsx
│   │   │   ├── SideBar.jsx
│   │   │   └── SubMenuBar.jsx
│   │   ├── modal/              # Modales específicos
│   │   └── ui-shared/          # Componentes Radix UI
│   │
│   ├── redux/                   # Redux store
│   │   ├── store.js
│   │   └── state/              # Slices (14+)
│   │       ├── userSlice.js
│   │       ├── statesSlice.js
│   │       └── ...
│   │
│   ├── hooks/                   # Custom hooks (26+)
│   │   ├── useDataTable.jsx
│   │   ├── useAccessRoutes.jsx
│   │   └── ...
│   │
│   ├── services/               # API services (17)
│   │   ├── AxiosHttpClient.js
│   │   ├── genericSearchService.js
│   │   └── ...
│   │
│   ├── routes/                 # Routing
│   │   └── router.jsx
│   │
│   ├── config/                 # Configuración
│   │   ├── index.js
│   │   └── routesDictionary.js
│   │
│   ├── cognito-auth/           # Autenticación
│   │   └── AuthContext.jsx
│   │
│   ├── locale/                 # i18n
│   │   ├── i18n.js
│   │   ├── en.json
│   │   └── es.json
│   │
│   ├── schemas/                # Validación
│   ├── enums/                  # Constantes
│   └── utils/                  # Utilidades
│
├── public/                     # Assets estáticos
├── vite.config.js             # Configuración Vite
├── tailwind.config.js         # Configuración Tailwind
└── package.json
```

---

## Arquitectura

### Jerarquía de Providers

```jsx
// App.jsx
<React.StrictMode>
  <QueryClientProvider client={queryClient}>
    <Provider store={store}>
      <ThemeProvider>
        <AuthProvider>
          <GeneralSetupProvider>
            <RouterProvider router={router} />
          </GeneralSetupProvider>
        </AuthProvider>
      </ThemeProvider>
    </Provider>
  </QueryClientProvider>
</React.StrictMode>
```

### Flujo de Datos

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│    View     │────▶│    Hooks     │────▶│   Service   │
│ (Component) │     │ (useQuery)   │     │  (Axios)    │
└─────────────┘     └──────────────┘     └──────┬──────┘
      │                    │                    │
      │                    ▼                    ▼
      │             ┌──────────────┐     ┌─────────────┐
      │             │ React Query  │     │    API      │
      │             │   (Cache)    │     │  Gateway    │
      │             └──────────────┘     └─────────────┘
      │
      ▼
┌─────────────┐
│   Redux     │
│ (UI State)  │
└─────────────┘
```

---

## Componentes

### Componentes Core

| Componente  | Descripción                    |
|-------------|--------------------------------|
| `Card`      | Contenedor con estilos         |
| `DataTable` | Tabla con paginación y filtros |
| `Modal`     | Diálogos modales               |
| `Form`      | Formularios con validación     |
| `Button`    | Botones estilizados            |
| `Input`     | Campos de entrada              |
| `Select`    | Selectores                     |
| `Tabs`      | Pestañas                       |
| `Toast`     | Notificaciones                 |

### Componentes Radix UI (ui-shared)

```jsx
// Importar desde ui-shared
import {
  Button,
  Dialog,
  DropdownMenu,
  Select,
  Tabs,
  Toast,
  Accordion,
  Command,
} from '@/components/ui-shared';
```

### Ejemplo de Componente

```jsx
// components/core/Card/Card.jsx
import { cn } from '@/lib/utils';

export function Card({ children, className, ...props }) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card text-card-foreground shadow-sm',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className, ...props }) {
  return (
    <div className={cn('flex flex-col space-y-1.5 p-6', className)} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ children, className, ...props }) {
  return (
    <div className={cn('p-6 pt-0', className)} {...props}>
      {children}
    </div>
  );
}
```

---

## Estado y Data Fetching

### Redux Store

```javascript
// redux/store.js
import { configureStore } from '@reduxjs/toolkit';
import userReducer from './state/userSlice';
import statesReducer from './state/statesSlice';
// ... más reducers

export const store = configureStore({
  reducer: {
    user: userReducer,
    states: statesReducer,
    clientId: clientIdReducer,
    nextCountItems: nextCountItemsReducer,
    generalSetup: generalSetupReducer,
    applicationSelected: applicationSelectedReducer,
    banner: bannerReducer,
    modalBehavior: modalBehaviorReducer,
    filterCases: filterCasesReducer,
    groupInformation: groupInformationReducer,
    showGroupsSelect: showGroupsSelectReducer,
    loadingCaseInformation: loadingCaseInformationReducer,
    myAgendaBehavior: myAgendaBehaviorReducer,
  },
});
```

### Redux Slice Ejemplo

```javascript
// redux/state/userSlice.js
import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  user: null,
  isAuthenticated: false,
  permissions: [],
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUser: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = true;
    },
    setPermissions: (state, action) => {
      state.permissions = action.payload;
    },
    logout: (state) => {
      state.user = null;
      state.isAuthenticated = false;
      state.permissions = [];
    },
  },
});

export const { setUser, setPermissions, logout } = userSlice.actions;
export default userSlice.reducer;
```

### React Query

```javascript
// hooks/useDataTable.jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { genericSearchService } from '@/services/genericSearchService';

export function useDataTable({ endpoint, filters, pagination }) {
  const queryClient = useQueryClient();

  // Query para obtener datos
  const { data, isLoading, error } = useQuery({
    queryKey: [endpoint, filters, pagination],
    queryFn: () => genericSearchService.search(endpoint, { filters, pagination }),
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Mutación para crear
  const createMutation = useMutation({
    mutationFn: (newData) => genericSearchService.create(endpoint, newData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [endpoint] });
    },
  });

  return {
    data: data?.data || [],
    total: data?.total || 0,
    isLoading,
    error,
    create: createMutation.mutate,
  };
}
```

---

## Routing

### Configuración de Rutas

```jsx
// routes/router.jsx
import { createBrowserRouter } from 'react-router-dom';
import { MainLayout } from '@/components/layouts/MainLayout';
import Dashboard from '@/pages/Dashboard';
import Cases from '@/pages/Cases';
// ... más imports

export const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthValidation />,
  },
  {
    path: '/',
    element: <MainLayout />,
    children: [
      {
        path: 'dashboard',
        element: <Dashboard />,
        loader: () => ({ key: 'dashboard', title: 'Dashboard' }),
      },
      {
        path: 'cases',
        element: <Cases />,
        loader: () => ({ key: 'cases', title: 'Cases' }),
      },
      {
        path: 'cases/:id',
        element: <CaseDetail />,
      },
      // ... más rutas
    ],
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);
```

### Diccionario de Rutas

```javascript
// config/routesDictionary.js
export const routes = {
  dashboard: {
    url: '/dashboard',
    key: 'dashboard',
    view: 'Dashboard',
    urlHistory: '/dashboard',
  },
  cases: {
    url: '/cases',
    key: 'cases',
    view: 'Cases',
    urlHistory: '/cases',
  },
  caseDetail: {
    url: '/cases/:id',
    key: 'case-detail',
    view: 'CaseDetail',
    urlHistory: '/cases/:id',
    parent: 'cases',
  },
  // ... 50+ rutas
};
```

---

## Autenticación

### AuthContext

```jsx
// cognito-auth/AuthContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { cognitoService } from '@/services/cognitoService';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const currentUser = await cognitoService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async () => {
    await cognitoService.signIn();
  };

  const logout = async () => {
    await cognitoService.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### Protección de Rutas

```jsx
// components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/cognito-auth/AuthContext';

export function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}
```

---

## Estilos

### Tailwind CSS

```javascript
// tailwind.config.js
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border))',
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        // ... más colores
      },
      fontFamily: {
        sans: ['Nunito', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};
```

### Variables CSS (Theming)

```css
/* index.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    /* ... más variables */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    /* ... más variables */
  }
}
```

### Utilidad cn()

```javascript
// lib/utils.js
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

// Uso
<div className={cn('base-class', condition && 'conditional-class', className)} />
```

---

## Internacionalización

### Configuración i18next

```javascript
// locale/i18n.js
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import es from './es.json';

i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: 'es',
  fallbackLng: 'en',
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
```

### Archivos de Traducción

```json
// locale/es.json
{
  "common": {
    "save": "Guardar",
    "cancel": "Cancelar",
    "delete": "Eliminar",
    "edit": "Editar",
    "search": "Buscar"
  },
  "cases": {
    "title": "Casos",
    "new": "Nuevo Caso",
    "status": "Estado",
    "priority": "Prioridad"
  }
}
```

### Uso en Componentes

```jsx
import { useTranslation } from 'react-i18next';

function CasesList() {
  const { t } = useTranslation();

  return (
    <div>
      <h1>{t('cases.title')}</h1>
      <button>{t('cases.new')}</button>
    </div>
  );
}
```

---

## Testing

### Configuración Vitest

```javascript
// vite.config.js
export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.js',
  },
});
```

### Setup de Tests

```javascript
// vitest.setup.js
import '@testing-library/jest-dom';
import { vi } from 'vitest';

// Mock de localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  clear: vi.fn(),
};
global.localStorage = localStorageMock;
```

### Ejemplo de Test

```jsx
// components/Card/Card.test.jsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Card, CardHeader, CardContent } from './Card';

describe('Card', () => {
  it('renders children correctly', () => {
    render(
      <Card>
        <CardHeader>Header</CardHeader>
        <CardContent>Content</CardContent>
      </Card>
    );

    expect(screen.getByText('Header')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<Card className="custom-class">Content</Card>);
    expect(screen.getByText('Content').parentElement).toHaveClass('custom-class');
  });
});
```

---

## Scripts de Desarrollo

```bash
# Desarrollo
pnpm run dev              # Servidor de desarrollo (localhost:5173)

# Build
pnpm run build            # Build de producción
pnpm run preview          # Preview del build

# Testing
pnpm run test             # Ejecutar tests
pnpm run test:watch       # Tests en modo watch
pnpm run test:coverage    # Tests con coverage

# Linting
pnpm run eslint-check     # Verificar linting
pnpm run format           # Formatear código

# Tipo checking
pnpm run typecheck        # Verificar tipos TypeScript
```

---

## Alias de Importación

```javascript
// vite.config.js
resolve: {
  alias: {
    '@': path.resolve(__dirname, './src'),
    '@kace_v2': path.resolve(__dirname, './src_v2'),
    '@kace/ui-shared': path.resolve(__dirname, './src/components/ui-shared'),
    '@kace/utils': path.resolve(__dirname, './src/utils'),
    '@kace/hooks': path.resolve(__dirname, './src/hooks'),
    '@kace/services': path.resolve(__dirname, './src/services'),
  },
}
```

### Uso

```javascript
// En lugar de:
import { Button } from '../../../components/ui-shared/Button';

// Usar:
import { Button } from '@kace/ui-shared';
import { useDataTable } from '@kace/hooks';
import { apiService } from '@kace/services';
```

---

## Buenas Prácticas

### Estructura de Páginas

```jsx
// pages/Cases/CasesHandler.jsx
import { useState } from 'react';
import { useDataTable } from '@/hooks/useDataTable';
import { CasesTable } from './components/CasesTable';
import { CasesFilters } from './components/CasesFilters';

export default function CasesHandler() {
  const [filters, setFilters] = useState({});
  const { data, isLoading, error } = useDataTable({
    endpoint: 'cases',
    filters,
  });

  if (error) return <ErrorMessage error={error} />;

  return (
    <div className="space-y-4">
      <CasesFilters onFilter={setFilters} />
      <CasesTable data={data} isLoading={isLoading} />
    </div>
  );
}
```

### Custom Hooks

```jsx
// hooks/useCases.jsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { casesService } from '@/services/casesService';

export function useCases(filters) {
  return useQuery({
    queryKey: ['cases', filters],
    queryFn: () => casesService.getAll(filters),
  });
}

export function useCreateCase() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: casesService.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cases'] });
    },
  });
}
```
