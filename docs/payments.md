# Payments — Fase 04

## Estado

La integración real de pagos está implementada sobre **Wompi Colombia**. El runtime no contiene fake providers, mocks de pago, respuestas simuladas ni datos de transacción de ejemplo.

La activación productiva requiere configurar las credenciales reales fuera de Git y registrar el webhook real en Wompi.

## Flujo real

```text
Checkout
  ↓
Order PENDING_PAYMENT
  ↓
POST /api/payments/intent
  ↓
Server valida customer + order + amount + currency
  ↓
Payment persistido con idempotency key
  ↓
Servidor genera referencia + SHA-256 integrity signature
  ↓
Wompi Web Checkout real
  ↓
Cliente paga en Wompi
  ↓
Wompi POST /api/payments/webhooks/wompi
  ↓
Verificación X-Event-Checksum / signature.checksum
  ↓
Validación amount + currency + reference
  ↓
PAID / FAILED / CANCELLED
  ↓
PAID → consumeForOrder()
FAILED/CANCELLED → releaseForOrder()
```

El redirect del navegador solo sirve para UX. Nunca se utiliza como prueba de pago confirmado.

## Endpoints

### Crear payment intent

```text
POST /api/payments/intent
Idempotency-Key: <unique-key>

{"orderId":"<order-id>"}
```

El servidor obtiene el importe desde la orden y no acepta un importe enviado por el navegador. La sesión del customer debe corresponder a la orden.

La respuesta contiene la configuración real de Wompi:

- provider;
- reference;
- public key;
- currency;
- amount in cents;
- integrity signature;
- checkout URL.

### Webhook

```text
POST /api/payments/webhooks/wompi
```

Se exige:

- `environment = prod`;
- evento `transaction.updated`;
- firma criptográfica válida;
- properties dinámicas proporcionadas por Wompi;
- timestamp incluido en la firma;
- secreto de eventos únicamente server-side.

El webhook no confía en un conjunto fijo de propiedades: utiliza exactamente las propiedades firmadas entregadas por Wompi.

## Idempotencia y concurrencia

La tabla `payments` tiene unicidad por `(customer_id, idempotency_key)` y por `provider_reference`.

Los cambios de estado utilizan:

```sql
UPDATE payments
SET status=?
WHERE id=? AND status=?
```

Esto evita que dos requests concurrentes apliquen la misma transición de pago.

Los cambios de estado de órdenes también son condicionales al estado anterior.

Los eventos de webhook se almacenan con unicidad `(provider, event_id)` para auditoría y protección contra duplicados. El procesamiento además es idempotente por estado: un `PAID` repetido no vuelve a consumir stock.

## Integración con inventario

Al confirmar un pago:

```text
payment → PAID
order   → PAID
reservation → consumeForOrder()
```

Al recibir `DECLINED`, `ERROR` o `VOIDED`:

```text
payment → FAILED/CANCELLED
order   → CANCELLED
reservation → releaseForOrder()
```

Las reservas se extienden al iniciar el pago para evitar que una sesión de checkout normal pierda stock durante el proceso de pago.

## Auditoría financiera

D1 registra:

- payment intent creado;
- payment confirmado;
- payment fallido;
- payment cancelado;
- security mismatch;
- aprobación tardía después de una orden cerrada;
- referencia del proveedor;
- transaction ID del proveedor;
- payload de webhook recibido.

No se almacenan secretos de Wompi en D1.

## Reconciliación

El adapter Wompi implementa consulta server-side de:

```text
GET https://production.wompi.co/v1/transactions/{transaction_id}
```

utilizando exclusivamente la llave privada de producción.

Esto permite reconciliar el estado del proveedor con el estado interno cuando existe el transaction ID real de Wompi.

## Credenciales de producción

Configurar como secretos del Worker:

```text
WOMPI_PUBLIC_KEY
WOMPI_PRIVATE_KEY
WOMPI_INTEGRITY_SECRET
WOMPI_EVENTS_SECRET
```

Para dinero real deben ser llaves de producción de Wompi, no `*_test_*`.

La URL de eventos de producción debe apuntar a:

```text
https://<production-host>/api/payments/webhooks/wompi
```

No registrar URLs sandbox para el entorno operativo de producción.

## Migrations

`migrations/0015_payments.sql` crea:

- `payments`;
- `payment_webhook_events`;
- `payment_ledger`;
- índices de búsqueda y estado;
- restricciones de unicidad necesarias para concurrencia e idempotencia.

## Refund / void

El modelo de dominio ya contempla `REFUNDED`, pero no se debe inventar una operación de refund que el adapter del proveedor no soporte. Wompi documenta la anulación (`void`) para transacciones de tarjeta en determinados estados. Por eso la certificación final de refunds debe cerrarse únicamente después de validar la capacidad real disponible para la cuenta/producto Wompi configurado, sin fake adapter ni endpoint ficticio.

## Criterio de cierre de Fase 04

La fase solo se declara 100% cuando además de este código exista evidencia real de producción de:

1. credenciales Wompi production configuradas fuera de Git;
2. webhook de producción registrado en Wompi;
3. pago real aprobado recibido por webhook;
4. orden movida a `PAID`;
5. reserva consumida exactamente una vez;
6. pago real rechazado/cancelado con liberación idempotente;
7. duplicación de webhook sin doble efecto;
8. amount/currency/reference manipulados rechazados;
9. reconciliación contra API privada de Wompi;
10. capacidad real de void/refund validada para el método de pago usado;
11. build Cloudflare, tests, architecture check y deploy de producción exitosos.
