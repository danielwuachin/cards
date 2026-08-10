Plan de Arquitectura Express V2: "Simple is Better" (KISS & PCI-DSS Compliant)
Contexto y Visión
Este documento es la especificación técnica completa y autónoma para la construcción del servicio REST de gestión de tarjetas de crédito en Express.js + TypeScript. No requiere consultar código ni configuraciones de proyectos anteriores.

Filosofía del Diseño
KISS (Keep It Simple, Stupid) & Elegancia Directa: Menos archivos, cero sobre-ingeniería, máxima claridad.
100% Programación Funcional (FP): Módulos con funciones puras, inmutabilidad y tipos explícitos.
Go / Elixir-inspired Error Handling: Patrón Result<T, E> (ok, err) para flujo explícito libre de excepciones ocultas (throw).
PCI-DSS Compliance: Cifrado AES-256-GCM para el PAN, IV aleatorio de 12 bytes por fila, authTag de 16 bytes e índice last4 seguro. Redacción automática de PAN en logs con Pino.
Sin Deduplicación Global de PAN (Strict Security): Prevención de vulnerabilidades de Card Enumeration Side-Channel, confiando en la idempotencia por Idempotency-Key a nivel de request.
Paginación Profesional por Cursor con UUIDv7: Ordenamiento determinista nativo (ORDER BY id DESC/ASC), devolviendo limit, nextCursor, prevCursor y hasMore.
RFC 7807 Problem Details: Errores estandarizados en formato application/problem+json.
1. Esquema de la Base de Datos (PostgreSQL Schema)
La base de datos (Postgres db_cards_test) consta de dos tablas principales optimizadas e indexadas:

sql

-- Habilitar extensión para UUIDs si es necesario
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
-- -----------------------------------------------------------------------------
-- Tabla: cards
-- Almacena los datos cifrados de la tarjeta y metadatos no sensibles
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cards (
    id UUID PRIMARY KEY,                             -- UUIDv7 (Timestamp embebido de 48-bit)
    encrypted_pan TEXT NOT NULL,                     -- Texto cifrado con AES-256-GCM
    iv VARCHAR(32) NOT NULL,                         -- Vector de inicialización Hex (12 bytes / 24 hex chars)
    auth_tag VARCHAR(32) NOT NULL,                   -- Etiqueta de autenticación Hex (16 bytes / 32 hex chars)
    last4 VARCHAR(4) NOT NULL,                       -- Últimos 4 dígitos en claro para búsqueda
    expiration_month INT NOT NULL,                   -- Mes de expiración (1-12)
    expiration_year INT NOT NULL,                    -- Año de expiración (4 dígitos, ej: 2030)
    holder_name VARCHAR(100) NOT NULL,               -- Nombre del titular de la tarjeta
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, -- Timestamp de creación
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP  -- Timestamp de última actualización
);
-- Índice para búsqueda rápida por últimos 4 dígitos (GET /cards:search?last4=)
CREATE INDEX IF NOT EXISTS idx_cards_last4 ON cards(last4);
-- Índice para ordenamiento cronológico secundario por fecha de creación
CREATE INDEX IF NOT EXISTS idx_cards_created_at ON cards(created_at DESC);
-- -----------------------------------------------------------------------------
-- Tabla: idempotency_keys
-- Almacena el resultado de las peticiones HTTP para garantizar idempotencia atómica
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,                    -- Clave de idempotencia (Header Idempotency-Key)
    request_hash VARCHAR(64) NOT NULL,               -- Hash SHA256 del body para verificar integridad
    status_code INT NOT NULL,                        -- Código de respuesta HTTP guardado (ej: 201)
    response_body JSONB NOT NULL,                    -- Respuesta JSON completa guardada
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP -- Timestamp de creación del lock
);
-- Índice para limpieza periódica o expiración de claves
CREATE INDEX IF NOT EXISTS idx_idempotency_created_at ON idempotency_keys(created_at);
2. Estructura de Archivos del Proyecto
Estructura plana, organizada por responsabilidad clara, con menos de 15 archivos en total:

text

src/
 ├── config.ts              # Variables de entorno tipadas y centralizadas (PORT, DB, KEYS)
 ├── db.ts                  # Pool de PostgreSQL (pg.Pool con manejo de conexiones)
 ├── logger.ts              # Instancia de Pino con redactor PCI-DSS (masking automático de PAN)
 ├── shared/
 │   ├── result.ts          # Patrón Result<T, E> (ok, err, isOk, isErr)
 │   └── errors.ts          # Catálogo de errores tipados RFC 7807 (BadRequest, NotFound, etc.)
 ├── utils/
 │   ├── luhn.ts            # Validaciones puras (Luhn checksum + Expiración MM/YY)
 │   ├── crypto.ts          # Cifrado / Descifrado AES-256-GCM puras
 │   └── cursor.ts          # Encoding/Decoding de cursor UUIDv7 en Base64
 ├── middleware/
 │   ├── idempotency.ts     # Middleware de idempotencia atómica por Idempotency-Key
 │   └── errorHandler.ts    # Middleware centralizado de errores RFC 7807
 ├── services/
 │   └── card.service.ts    # Funciones puras de servicio (createCard, getCardById, listCards, searchByLast4)
 ├── controllers/
 │   ├── card.controller.ts # Handlers funcionales HTTP para /cards
 │   └── health.controller.ts# Handler funcional HTTP para /health (con instanceId)
 ├── routes/
 │   ├── card.routes.ts     # Router Express para /cards
 │   └── health.routes.ts   # Router Express para /health
 └── app.ts                 # Configuración de Express, middlewares y servidor (export app & listen)
3. Especificación de Endpoints HTTP
Método	Ruta	Descripción	Params / Headers
POST	/cards	Crea y cifra una tarjeta	Body: pan, expirationMonth, expirationYear, holderName. Header opcional: Idempotency-Key
GET	/cards/:id	Obtiene una tarjeta por ID	Param: id (UUIDv7). Retorna PAN enmascarado
GET	/cards	Lista tarjetas paginadas	Query params: limit (default 10, max 100), cursor (Base64 string), order (asc/desc, default desc)
GET	/cards:search	Busca tarjetas por last4	Query param: last4 (4 dígitos numéricos)
GET	/health	Healthcheck para ALB	Retorna { status: "OK", instanceId: "hostname-o-env" }
4. Archivos de Referencia en la Raíz del Proyecto
FEATURES_V2.feature
: Especificación Gherkin BDD completa etiquetada por tareas @T01 - @T18.
ROADMAP_V2.md
: Hoja de ruta paso a paso con los criterios de aceptación y archivos de cada tarea.
DECISIONS_V2.md
: Guía de ciberseguridad PCI-DSS, patrones FP y decisiones ADR.