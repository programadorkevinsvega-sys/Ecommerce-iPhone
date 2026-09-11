# Payments — Fase 04

## Estado

La arquitectura de pagos es multi-provider y mantiene implementaciones reales server-side para **Wompi, Stripe, Mercado Pago, PayPal y Binance Pay**. No existen fake providers, mocks de pago, respuestas simuladas ni datos transaccionales de ejemplo en el runtime.

El provider activo se selecciona exclusivamente mediante `PAYMENT_PROVIDER` en configuración del Worker. Las credenciales permanecen fuera de Git.

## Proveedores

- Wompi Colombia: Web Checkout real, firma de integridad, eventos `transaction.updated`, checksum y reconciliación privada.
- Stripe: PaymentIntents reales, idempotencia de API, client secret y reconciliación.
- Mercado Pago: Checkout Preferences reales, idempotencia y consulta de pagos.
- PayPal: Orders v2 reales con intent `CAPTURE`, OAuth server-side y consulta/reconciliación.
- Binance Pay: Merchant API real, firma HMAC-SHA512, creación y consulta de órdenes.

Las capacidades específicas de captura, void, refund y webhook se mantienen en cada adapter; el dominio no conoce APIs externas.

## Flujo común

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
Adapter real del provider
  ↓
Checkout/provider client flow
  ↓
Webhook firmado o reconciliación server-side
  ↓
Normalización de estado
  ↓
PAID / FAILED / CANCELLED
  ↓
PAID → consumeForOrder()
FAILED/CANCELLED → releaseForOrder()
```

El redirect del navegador solo sirve para UX. Nunca se utiliza como prueba de pago confirmado.

## Wompi — integración real

### Crear checkout

```text
POST /api/payments/intent
Idempotency-Key: <unique-key>
{"orderId":"<order-id>"}
```

El servidor obtiene importe y moneda desde la orden. Wompi recibe una referencia determinista, firma SHA-256 de integridad y configuración de Web Checkout.

### Webhook

```text
POST /api/payments/webhooks/wompi
```

Se valida:

- `environment = prod`;
- evento `transaction.updated`;
- `signature.properties` dinámicas;
- valores firmados exactamente en el orden recibido;
- `timestamp`;
- checksum criptográfico;
- `amount`, `currency` y `reference` contra D1;
- estado externo permitido.

### Reconciliación

El adapter consulta server-side:

```text
GET https://production.wompi.co/v1/transactions/{transaction_id}
```

con la llave privada de producción.

### Void

Wompi expone una operación server-side de `void` para transacciones de tarjeta en estados compatibles. La aplicación no inventa una operación de refund universal: la capacidad se expone únicamente cuando el método y estado reales del proveedor la permiten.

## Idempotencia y concurrencia

La tabla `payments` mantiene unicidad por `(customer_id, idempotency_key)` y `provider_reference`. La URL de checkout se persiste para que una repetición de la misma solicitud no vuelva a crear una operación externa.

Los cambios de estado utilizan actualización condicional:

```sql
UPDATE payments
SET status=?
WHERE id=? AND status=?
```

Los eventos externos se almacenan con unicidad `(provider, event_id)`. El procesamiento es idempotente: una confirmación repetida no vuelve a consumir stock.

## Auditoría financiera

D1 registra intents, confirmaciones, fallos, cancelaciones, mismatches de seguridad, aprobaciones tardías, referencias externas, transaction IDs y payloads de webhook.

No se almacenan secretos de proveedores en D1.

## Credenciales

### Wompi

```text
WOMPI_PUBLIC_KEY
WOMPI_PRIVATE_KEY
WOMPI_INTEGRITY_SECRET
WOMPI_EVENTS_SECRET
```

### Stripe

```text
STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET
```

### Mercado Pago

```text
MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_WEBHOOK_SECRET
```

### PayPal

```text
PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_WEBHOOK_ID
```

### Binance Pay

```text
BINANCE_PAY_API_KEY
BINANCE_PAY_SECRET_KEY
BINANCE_PAY_CERTIFICATE_SN
```

Para el entorno operativo se utilizan exclusivamente credenciales reales de producción. No se incorporan credenciales sandbox al runtime productivo.

## Migrations

- `0015_payments.sql`: modelo inicial de pagos.
- `0016_multi_provider_payments.sql`: amplía providers soportados y persiste `checkout_url`.

## Criterio de cierre de Fase 04

La implementación de código no se declara 100% certificada hasta disponer de evidencia real por cada provider habilitado:

1. credenciales production configuradas fuera de Git;
2. webhook production registrado;
3. pago real aprobado recibido y verificado;
4. orden movida a `PAID`;
5. reserva consumida exactamente una vez;
6. pago real rechazado/cancelado con liberación idempotente;
7. duplicación de webhook sin doble efecto;
8. amount/currency/reference manipulados rechazados;
9. reconciliación server-side exitosa;
10. capacidades de void/refund verificadas según método real;
11. build Cloudflare, tests, architecture check y deploy de producción exitosos.
