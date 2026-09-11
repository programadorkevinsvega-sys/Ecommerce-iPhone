# Payments — Fase 04

## Estado

La arquitectura de pagos es multi-provider y permite utilizar **Wompi, Stripe, Mercado Pago, PayPal y Binance Pay simultáneamente**. No existe un provider global único ni un `PAYMENT_PROVIDER` que fuerce a toda la plataforma a utilizar un solo gateway.

Todos los adapters se registran server-side en un `PaymentProviderRegistry`. Cada payment selecciona su proveedor de forma explícita y persiste esa elección junto con su referencia externa. Las credenciales permanecen fuera de Git.

## Webhooks reales

Cada provider tiene su endpoint independiente y todos convergen en el mismo `PaymentService`:

```text
/api/payments/webhooks/wompi
/api/payments/webhooks/stripe
/api/payments/webhooks/mercadopago
/api/payments/webhooks/paypal
/api/payments/webhooks/binance-pay
```

Antes de cualquier efecto financiero se verifica la autenticidad del evento:

- Wompi: checksum/event signature.
- Stripe: `Stripe-Signature`, timestamp y HMAC-SHA256.
- Mercado Pago: `x-signature`, `x-request-id`, `data.id`, timestamp y HMAC-SHA256.
- PayPal: verificación server-side contra la API oficial de PayPal usando webhook ID y headers de transmisión.
- Binance Pay: HMAC-SHA512, timestamp, nonce y certificate serial.

El webhook nunca se considera una confirmación válida solamente por contener un estado `approved`; el sistema consulta/reconcilia el recurso real del provider y valida provider, referencia, amount y currency antes de modificar la orden.

## Proveedores

- Wompi Colombia: Web Checkout real, firma de integridad, eventos `transaction.updated`, checksum y reconciliación privada.
- Stripe: PaymentIntents reales, idempotencia de API, client secret, webhook firmado y reconciliación.
- Mercado Pago: Checkout Preferences reales, idempotencia, webhook HMAC y consulta de pagos.
- PayPal: Orders v2 reales con intent `CAPTURE`, OAuth server-side, captura después de `CHECKOUT.ORDER.APPROVED`, webhook verificado y consulta/reconciliación.
- Binance Pay: Merchant API real, firma HMAC-SHA512, creación, webhook firmado y consulta de órdenes.

Las capacidades específicas de captura, void, refund y webhook se mantienen en cada adapter; el dominio no conoce APIs externas.

## Selección simultánea

El checkout envía el proveedor elegido:

```text
POST /api/payments/intent
Idempotency-Key: <unique-key>
{"orderId":"<order-id>","paymentProvider":"STRIPE"}
```

El servidor valida que el provider pertenece al conjunto soportado y resuelve el adapter mediante `PaymentProviderRegistry`.

Producción puede tener simultáneamente:

```text
WOMPI        → habilitado
STRIPE       → habilitado
MERCADOPAGO  → habilitado
PAYPAL       → habilitado
BINANCE_PAY  → habilitado
```

Una orden puede usar Wompi mientras otra usa Stripe, Mercado Pago, PayPal o Binance Pay. No se necesita redeploy para cambiar el proveedor de una nueva orden.

El cliente únicamente selecciona el identificador del método. Nunca recibe ni controla secretos, tokens privados, firmas o lógica interna del adapter.

## Modelo de runtime

```text
Checkout
   ↓
PaymentService
   ↓
PaymentProviderRegistry
   ├── WOMPI
   ├── STRIPE
   ├── MERCADOPAGO
   ├── PAYPAL
   └── BINANCE_PAY
          ↓
      Provider API

Provider Webhook
       ↓
Signature Verification
       ↓
Provider API reconciliation
       ↓
PaymentService
       ↓
PAID / FAILED / CANCELLED
       ↓
PAID → consumeForOrder()
FAILED/CANCELLED → releaseForOrder()
```

El `Payment` persistido conserva:

```text
provider
provider_reference
provider_transaction_id
checkout_url
```

La misma `Idempotency-Key` queda vinculada al provider original. Repetirla con otro provider es rechazado para evitar ambigüedad financiera.

## Ciclo completo por provider

### Éxito

```text
intent
 → provider checkout
 → webhook firmado
 → consulta server-side
 → amount/currency/reference validation
 → ProviderTransaction APPROVED
 → Order PAID
 → Payment PAID
 → consumeForOrder() exactamente una vez
```

### Fallo/cancelación

```text
intent
 → provider checkout
 → webhook firmado/reconciliation
 → ProviderTransaction DECLINED/ERROR/VOIDED
 → Payment FAILED/CANCELLED
 → Order CANCELLED
 → releaseForOrder() idempotente
```

### Reconciliación

```text
provider + transactionId
 → adapter.getTransaction()
 → normalización ProviderTransaction
 → mismo PaymentService
 → mismo state machine
```

Por tanto, webhook y reconciliación comparten la misma ruta de negocio y no pueden tener reglas financieras diferentes.

## Wompi

```text
POST /api/payments/webhooks/wompi
```

Se valida `environment`, `transaction.updated`, `signature.properties`, timestamp, checksum y luego se reconcilia contra Wompi antes de procesar el estado.

## Stripe

```text
POST /api/payments/webhooks/stripe
```

Se valida `Stripe-Signature` sobre el **raw body** y ventana temporal. Los eventos `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled` y `payment_intent.processing` se reconcilian mediante el PaymentIntent real.

## Mercado Pago

```text
POST /api/payments/webhooks/mercadopago
```

Se valida `x-signature` con `data.id`, `x-request-id` y timestamp mediante HMAC-SHA256. Los eventos de tipo `payment` se consultan nuevamente en Mercado Pago antes de procesarlos.

## PayPal

```text
POST /api/payments/webhooks/paypal
```

La firma se verifica mediante el endpoint oficial de PayPal. Para `CHECKOUT.ORDER.APPROVED`, el servidor ejecuta la captura real del Order antes de llevar el resultado a `PaymentService`. No se considera el redirect del navegador como pago.

## Binance Pay

```text
POST /api/payments/webhooks/binance-pay
```

Se valida HMAC-SHA512 con timestamp, nonce y certificate serial. La orden se consulta server-side mediante el identificador recibido y solamente después se procesa su estado normalizado.

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

Las credenciales de cada provider son independientes. Se pueden configurar las cinco simultáneamente. La ausencia de credenciales de un provider no elimina los demás; intentar utilizar un provider sin sus credenciales falla de forma explícita y server-side.

## Migrations

- `0015_payments.sql`: modelo inicial de pagos.
- `0016_multi_provider_payments.sql`: providers soportados y `checkout_url`.

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
