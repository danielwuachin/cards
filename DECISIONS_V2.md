# DECISIONS V2 — Decisiones de Arquitectura, Ciberseguridad & PCI-DSS

Este documento contiene las reglas de diseño, patrones de arquitectura, guías de ciberseguridad PCI-DSS y decisiones operativas para la construcción del servicio de tarjetas de crédito en Express.js.

---

## 1. Guía de Ciberseguridad & PCI-DSS (Reglas de Obligatorio Cumplimiento)

### A. Almacenamiento Cifrado de Datos Sensibles (PAN)
- **Algoritmo de cifrado**: `AES-256-GCM` (Galois/Counter Mode), el estándar recomendado por PCI-DSS v4.0 por proveer confidencialidad e integridad autenticada.
- **Vector de Inicialización (IV)**: Cada tarjeta cifrada debe generar un `IV` criptográficamente seguro de 12 bytes (`crypto.randomBytes(12)`). **Está estrictamente prohibido reutilizar IVs.**
- **Auth Tag**: Cada cifrado debe almacenar la etiqueta de autenticación de 16 bytes (`authTag`) retornada por AES-GCM para verificar que el texto cifrado no ha sido alterado.
- **Clave de cifrado (`CARD_ENCRYPTION_KEY`)**: Clave de 32 bytes (256 bits) cargada exclusivamente mediante variables de entorno desde AWS Secrets Manager / `.env`.

### B. Prohibición de Registro y Fuga de PAN (Zero-Log Policy)
- El PAN completo en texto plano **NUNCA debe ser registrado en logs**, serializado en excepciones ni guardado en texto claro en disco o base de datos.
- **Redacción en Pino Logger**: El logger Pino debe contar con reglas activas de mascaramiento (*redactors*) para las propiedades `pan`, `cardNumber`, `creditCard`, `authorization` y headers sensibles.
- **Respuesta de la API**: Toda respuesta de la API que retorne información de tarjeta debe devolver únicamente el PAN enmascarado (`**** **** **** 1234`). El PAN en claro solo ingresa en el body del `POST /cards` y se cifra inmediatamente en memoria.

### C. Prevención de Ataques de Enumeración (Card Enumeration Side-Channel)
- En sistemas financieros sin autenticación de usuario (`customer_id`), colocar un constraint `UNIQUE` global al PAN en la base de datos es un anti-patrón de seguridad. Permitiría a atacantes enviar peticiones POST y deducir qué tarjetas de crédito existen en el sistema según la respuesta de la API (`409 Conflict`).
- Por tanto, la prevención de duplicados por reintentos de red o envíos accidentales se resuelve **únicamente a nivel de petición HTTP mediante el header `Idempotency-Key`**.

---

## 2. Decisiones de Arquitectura y Patrones

### ADR-001 — Paradigma 100% Programación Funcional (FP) & Patrón `Result<T, E>`

**Contexto.** Queremos una arquitectura ligera, modular y ultra-testeable sin la sobre-ingeniería de clases abstractas o contenedores de Inyección de Dependencias pesados.

**Decisión.** Estructurar el dominio y la aplicación usando Programación Funcional (FP) con módulos de funciones puras e inmutables. Toda función de servicio retornará un tipo explícito `Result<T, E>` (`ok(value)` / `err(error)`). Ninguna función de servicio o dominio lanzará excepciones `throw`.

**Beneficios.**
- Los errores son parte del tipo de retorno, obligando a manejarlos de forma explícita (estilo Go / Elixir).
- Cero `try/catch` difusos en la capa de negocio.
- Testing unitario 100% directo sin necesidad de mocks complejos.

---

### ADR-002 — Paginación Profesional por Cursor basada en UUIDv7

**Contexto.** La paginación tradicional por `OFFSET` sufre degradación de rendimiento en tablas grandes y problemas de *page drift* cuando se insertan registros mientras el cliente navega.

**Decisión.** Adoptar UUIDv7 como identificador primario de las tarjetas. UUIDv7 incorpora un timestamp de 48 bits (milisegundos Unix) en sus primeros bytes, garantizando que los UUIDs estén ordenados cronológicamente de forma nativa (`ORDER BY id DESC`/`ASC`).

**Formato de Respuesta de Paginación:**
```json
{
  "data": [...],
  "pagination": {
    "limit": 10,
    "nextCursor": "eyJpZCI6IjAxOTEzN2UwLTkxMTEtNzMzMy04YmJiLTEyMzQ1Njc4OWFiYyJ9",
    "prevCursor": null,
    "hasMore": true
  }
}
```

---

### ADR-003 — Formato de Errores RFC 7807 (Problem Details)

**Contexto.** La API requiere un formato estándar internacional para la devolución de errores HTTP.

**Decisión.** Toda respuesta de error (400, 404, 409, 500) se formateará según el estándar RFC 7807 (`Content-Type: application/problem+json`):
```json
{
  "type": "https://api.cards.local/errors/invalid-pan",
  "title": "Bad Request",
  "status": 400,
  "detail": "The provided PAN failed the Luhn checksum validation algorithm",
  "instance": "/cards"
}
```
