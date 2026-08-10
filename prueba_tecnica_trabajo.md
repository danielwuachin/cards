Prueba Senior Backend Engineer L3 —
CRUD de Tarjetas en AWS
Objetivo
Construir y desplegar en AWS un servicio REST para crear y consultar tarjetas, detrás de
un Application Load Balancer con ≥2 réplicas. Incluir un diagrama simple de
arquitectura y evidencia de distribución de carga.
Alcance mínimo
●
Endpoints:
○
○
○
○
POST /cards → crea tarjeta.
GET /cards/{id} → obtiene por id.
GET /cards?limit=&cursor= → lista (paginado simple).
GET /cards:search?last4= → búsqueda por últimos 4.
●
Reglas:
○
○
○
Validar PAN (Luhn) y expiración.
Almacenar PAN de forma segura
Idempotencia por Idempotency-Key.
Requisitos técnicos
●
●
●
●
ALB (HTTPS) → 2+ réplicas (ECS/EKS/EC2 ASG) en subnets privadas.
Persistencia: RDS Postgres o DynamoDB.
Secrets Manager para credenciales/salt. Logs y métricas básicas en CloudWatch.
Endpoint GET /health que incluya un identifier de instancia.
Entregables
1. Repo con app + IaC + README (deploy, env vars, ejemplos curl).
2. Diagrama (PNG o draw.io) con VPC, ALB, service y DB.
3. Evidencia de balanceo: salida de GET /health bajo carga (hey/ab/k6) mostrando
alternancia de instancias o métricas del ALB por target.