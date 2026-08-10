# CODE_STANDARDS.md — Estándares de Código (Express.js + TypeScript + PNPM)

Este documento define las reglas de codificación, herramientas y estándares del proyecto **Express V2**. Ante la duda, elegir la opción más simple que las cumpla (KISS).

---

## 1. Herramientas & Entorno de Desarrollo (PNPM)

- **Gestor de Paquetes**: `pnpm` obligatorio (cero `npm` o `yarn`).
- **Sin git hooks**: corre `pnpm lint` y `pnpm test` a mano antes de commitear, o confía en que el job de CI los corre en cada push.
- **Commitlint (Conventional Commits)**: Todo mensaje de commit debe seguir el formato estándar:
  - `feat: <descripción>` — Nueva funcionalidad
  - `fix: <descripción>` — Corrección de error
  - `docs: <descripción>` — Cambios en documentación
  - `test: <descripción>` — Adición o modificación de pruebas
  - `refactor: <descripción>` — Cambio de código que no arregla ni agrega funcionalidad
  - `chore: <descripción>` — Mantenimiento, dependencias o configuración

---

## 2. Configuración de TypeScript

`tsconfig.json` debe incluir obligatoriamente en modo estricto:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "baseUrl": ".",
    "paths": {
      "@shared/*": ["src/shared/*"],
      "@utils/*": ["src/utils/*"],
      "@services/*": ["src/services/*"],
      "@controllers/*": ["src/controllers/*"],
      "@middleware/*": ["src/middleware/*"],
      "@config/*": ["src/config/*"]
    }
  }
}
```

### Reglas Estrictas de Código:
- **Cero `any`**: Usar `unknown` y estrechar con type guards o funciones puras.
- **Cero `@ts-ignore` o `@ts-expect-error`**: Corregir los tipos si el compilador se queja.
- **Cero aserciones manuales `as`** (salvo en pruebas unitarias).
- **Tipos de retorno explícitos** en toda función exportada.
- **Propiedades `readonly` por defecto** en tipos e interfaces.

---

## 3. Nomenclatura y Estructura de Archivos

- Archivos en `kebab-case` con sufijos por rol:
  - `card.service.ts`
  - `card.controller.ts`
  - `card.routes.ts`
  - `idempotency.middleware.ts`
  - `error-handler.middleware.ts`
  - `luhn.util.ts`
  - `crypto.util.ts`
  - `cursor.util.ts`
  - `*.spec.ts` (Pruebas unitarias)
  - `*.e2e-spec.ts` (Pruebas E2E / Supertest)

- Prohibición de nombres vagos o genéricos: Nada de `utils.ts`, `helpers.ts`, `misc.ts` o `data.ts`. Los archivos deben tener responsabilidades únicas y nombres explícitos.

---

## 4. El Patrón `Result<T, E>` (Go/Elixir style)

Ubicación: `src/shared/result.ts`

```typescript
export type Result<T, E = AppError> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}

export function isOk<T, E>(r: Result<T, E>): r is { ok: true; value: T } {
  return r.ok === true;
}

export function isErr<T, E>(r: Result<T, E>): r is { ok: false; error: E } {
  return r.ok === false;
}
```

### Flujo de Manejo de Errores:
- **Capa de Negocio / Servicios**: Devuelve `Result<T, E>`. NUNCA lanza `throw`.
- **Capa de Controladores HTTP (Express)**: Evalúa `if (result.isErr()) return next(result.error);`.
- **Middleware de Errores (Express)**: Recibe el error mediante `next(err)` y responde con el formato RFC 7807 (`application/problem+json`).

---

## 5. PCI-DSS y Logging Seguro (Pino)

- Salida estructurada en JSON con Pino logger (`src/logger.ts`).
- **NUNCA usar `console.log`**.
- Configuración obligatoria de redactor para campos sensibles:
  ```typescript
  redact: {
    paths: ['req.body.pan', 'req.headers.authorization', '*.pan', '*.encryptedPan'],
    censor: '[REDACTED]',
  }
  ```
- Ningún PAN en texto plano debe persistirse en logs ni aparecer en respuestas de la API (siempre enmascarado como `**** **** **** 1234`).

---

## 6. Estrategia de Testing (Jest + Supertest)

- **Tests Unitarios**: Para utilidades puras (`luhn.ts`, `crypto.ts`, `cursor.ts`, `result.ts`).
- **Tests E2E / Integración**: Con Supertest ejecutando contra los endpoints de Express y base de datos Postgres real (`db_cards_test`).
- **3 Escenarios Críticos Obligatorios**:
  1. **Carrera de idempotencia**: Varias peticiones concurrentes con la misma `Idempotency-Key` devuelven la misma respuesta y solo crean 1 registro.
  2. **Zero PAN Leak**: Verificación de que el PAN nunca aparece en logs en caso de éxito o error.
  3. **Paginación por Cursor**: Navegación consistente mediante `nextCursor` y `prevCursor` sin duplicados.
