# DECISIONS V2 — Decisiones de Arquitectura, Ciberseguridad & PCI-DSS

Este documento contiene las reglas de diseño, patrones de arquitectura, guías de ciberseguridad PCI-DSS y decisiones operativas refinadas para la construcción del servicio de tarjetas de crédito en Express.js.

---

## 1. Guía de Ciberseguridad & PCI-DSS (Reglas de Obligatorio Cumplimiento)

### A. Almacenamiento Cifrado de Datos Sensibles (PAN) con AAD
- **Algoritmo de cifrado**: `AES-256-GCM` (Galois/Counter Mode), el estándar recomendado por PCI-DSS v4.0.
- **Vector de Inicialización (IV)**: Cada tarjeta cifrada genera un `IV` aleatorio de 12 bytes (`crypto.randomBytes(12)`). **Prohibido reutilizar IVs.**
- **Auth Tag**: Etiqueta de autenticación de 16 bytes (`authTag`) para integridad.
- **AAD (Additional Authenticated Data)**: Se pasa el `card.id` (UUIDv7) como AAD (`cipher.setAAD(Buffer.from(cardId))`). Esto impide que un atacante mueva o transponga ciphertexts entre filas de la base de datos.
- **Fail-Fast al arranque**: La aplicación valida al iniciar que `CARD_ENCRYPTION_KEY` contenga exactamente 64 caracteres hexadecimales (32 bytes). Si es inválida, se detiene el proceso inmediatamente (`process.exit(1)`).

### B. Prohibición de Registro y Fuga de PAN (Zero-Log Policy & Request ID)
- El PAN completo en texto plano **NUNCA debe ser registrado en logs**, serializado en excepciones ni guardado en texto claro.
- **Redacción en Pino Logger**: Pino cuenta con reglas de mascaramiento (*redactors*) para las propiedades `pan`, `cardNumber`, `creditCard`, `authorization` y headers sensibles.
- **Trazabilidad mediante Request ID (`x-request-id`)**: Cada petición HTTP genera o propaga un header `x-request-id` (UUIDv4) que Pino adjunta automáticamente a todos los logs de esa solicitud para rastreabilidad en AWS CloudWatch con múltiples réplicas.

### C. Prevención de Enumeración & Rate Limiting (Anti-Brute Force)
- Sin autenticación de usuario (`customer_id`), no se aplica `UNIQUE` constraint global al PAN para evitar vulnerabilidades de **Card Enumeration Side-Channel** (descubrimiento de tarjetas mediante peticiones POST).
- Se aplica **`express-rate-limit`** en las rutas `/cards` y especialmente `/cards:search` (máximo 30 peticiones por minuto por IP) para impedir ataques de fuerza bruta sobre los últimos 4 dígitos.

---

## 2. Decisiones de Arquitectura y Patrones

### ADR-001 — Paradigma 100% Programación Funcional (FP), Zod & Patrón `Result<T, E>`
- Estructuración con módulos de funciones puras.
- Validación de entradas HTTP mediante **`zod`** (tipado estático directo y mensajes RFC 7807).
- Toda función de servicio o utilidad devuelve `Result<T, E>` (`ok(value)` / `err(error)`). Cero `throw` en la capa de negocio.

---

### ADR-002 — Idempotencia Atómica con Estados (`in_progress` / `completed`)

**Schema de la tabla `idempotency_keys`:**
```sql
CREATE TABLE idempotency_keys (
    key VARCHAR(255) PRIMARY KEY,
    request_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress', -- 'in_progress' | 'completed'
    status_code INT,
    response_body JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);
```

**Manejo de Concurrencia:**
1. Al recibir `Idempotency-Key`, realiza `INSERT ... ON CONFLICT (key) DO NOTHING`.
2. Si no inserta fila, la clave ya existe:
   - Si `status === 'completed'` y `request_hash` coincide: Devuelve la respuesta devuelta previamente (Cache replay).
   - Si `status === 'completed'` pero `request_hash` es distinto: Devuelve `422 Unprocessable Entity` (conflicto de payload).
   - Si `status === 'in_progress'`: Devuelve `409 Conflict` (petición concurrente en vuelo).

---

### ADR-003 — Healthchecks Separados: Liveness (`/health`) vs Readiness (`/health/ready`)

- **`GET /health` (Liveness)**: Comprobación superficial (*shallow*). Retorna `{ status: "OK", instanceId }`. Utilizado exclusivamente por el AWS Application Load Balancer (ALB) Target Group. Garantiza que la latencia o saturación temporal de Postgres no provoque que el ALB destruya los contenedores.
- **`GET /health/ready` (Readiness)**: Comprobación profunda (*deep*). Toca la base de datos Postgres (`SELECT 1`). Devuelve `{ status: "OK", database: "connected", instanceId }`.

---

### ADR-004 — Graceful Shutdown (SIGTERM / SIGINT)

- La aplicación captura señales `SIGTERM` y `SIGINT` para drenar conexiones HTTP activas y cerrar el pool de conexiones de PostgreSQL limpiamente (`pool.end()`), garantizando desplegados cero-downtime en AWS ECS Fargate.

---

### ADR-005 — Escape de Ruta en Express para `/cards:search`

- En Express 4, la ruta `/cards:search` utiliza la sintaxis `/cards\\:search` para evitar que `path-to-regexp` interprete `:search` como un parámetro de ruta dinámico (`req.params.search`).
