# ROADMAP V2 — Express.js Credit Card Service ("Simple is Better")

> **Misión V2**: Construir el servicio REST de gestión de tarjetas de crédito en **Express.js + TypeScript**, con 100% de calidad Senior L3, arquitectura funcional (FP), cero sobre-ingeniería (KISS), cifrado AES-256-GCM PCI-DSS compliant, idempotencia atómica y paginación profesional por cursor.

---

## Estado del Proyecto

- [x] T01 — Configuración inicial del proyecto Express, TypeScript, ESLint, Prettier, Husky, Commitlint y `.env`
- [ ] T02 — Logger Pino con redactor PCI-DSS (masking automático de PAN)
- [ ] T03 — Módulo `Result<T, E>` y catálogo de errores RFC 7807 (`shared/result.ts`, `shared/errors.ts`)
- [ ] T04 — Pool de conexión Postgres (`src/db.ts`) y script de migraciones (`cards`, `idempotency_keys`)
- [ ] T05 — Utilidades puras: Validador de Luhn y Expiración MM/YY (`utils/luhn.ts`)
- [ ] T06 — Utilidades puras: Módulo Crypto AES-256-GCM (`utils/crypto.ts`)
- [ ] T07 — Utilidades puras: Encoding/Decoding de Cursor Base64 con UUIDv7 (`utils/cursor.ts`)
- [ ] T08 — Servicio: `createCard` (validación, cifrado AES, guardado en BD)
- [ ] T09 — Servicio: `getCardById` (búsqueda y enmascaramiento de PAN)
- [ ] T10 — Servicio: `listCards` (Paginación profesional por cursor UUIDv7 `prevCursor`, `nextCursor`, `limit`, `order`)
- [ ] T11 — Servicio: `searchByLast4` (Búsqueda por últimos 4 dígitos)
- [ ] T12 — Middleware centralizado de errores RFC 7807 (`middleware/errorHandler.ts`)
- [ ] T13 — Route & Controller: `GET /health` con `instanceId`
- [ ] T14 — Routes & Controllers HTTP: `/cards` (`POST`, `GET /:id`, `GET /`, `GET /:search`)
- [ ] T15 — Middleware de Idempotencia por `Idempotency-Key` (`middleware/idempotency.ts`)
- [ ] T16 — Suite de Tests de Integración / E2E con Jest + Supertest
- [ ] T17 — IaC Terraform (ALB + ECS/EC2 + RDS) y Diagrama de Arquitectura (PNG)
- [ ] T18 — Entregable final: README.md completo con comandos curl y evidencia de balanceo

---

## Fichas Detalladas de Tareas

### T01: Configuración Inicial del Proyecto Express
- **Estado**: ✅ COMPLETADO
- **Objetivo**: Inicializar el proyecto Express con TypeScript en modo `strict`, scripts de NPM/PNPM, ESLint, Prettier, Husky y Commitlint.
- **Archivos**: `package.json`, `tsconfig.json`, `.env.example`, `.env`, `.eslintrc.js`, `.prettierrc`, `commitlint.config.js`, `.gitignore`.
- **Criterio de Aceptación**: `package.json` y configuraciones estrictas listas para `pnpm install`.
