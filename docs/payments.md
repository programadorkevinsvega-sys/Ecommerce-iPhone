# Payments — Fase 04

## Estado

La arquitectura de pagos es multi-provider y permite utilizar **Wompi, Stripe, Mercado Pago, PayPal y Binance Pay simultáneamente**. No existe un provider global único ni un `PAYMENT_PROVIDER` que fuerce a toda la plataforma a utilizar un solo gateway.

Todos los adapters se registran server-side en un `PaymentProviderRegistry`. Cada payment selecciona su proveedor de forma explícita y persiste esa elección junto con su referencia externa. Las credenciales permanecen fuera de Git.

**Estado de certificación:** implementación lista para certificación operativa; **los cinco flujos todavía no se declaran certificados en producción hasta obtener evidencia real de cada provider**.

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

## Certificación real de producción

La certificación de Fase 04 se ejecutará exclusivamente contra el despliegue de producción y requiere evidencia observable en el provider y en D1. No se considera válida una prueba que solamente cambie estados en la base de datos ni un webhook inyectado manualmente como sustituto del evento real.

### Matriz obligatoria

| Provider | Intent real | Pago real aprobado | Webhook real | PAID | Reserva consume | Fallo/cancelación real | Reserva release | Replay idempotente | Reconciliación |
|---|---|---|---|---|---|---|---|---|---|
| Wompi | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Stripe | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Mercado Pago | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| PayPal | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |
| Binance Pay | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE | PENDIENTE |

### Secuencia por provider

1. Crear una orden de certificación con un monto pequeño pero real.
2. Crear el intent mediante `/api/payments/intent` con una `Idempotency-Key` nueva.
3. Completar el pago utilizando el checkout oficial del provider.
4. Confirmar que el provider registra la transacción real como aprobada.
5. Confirmar recepción del webhook en producción y verificar firma/autenticidad.
6. Confirmar reconciliación server-side contra la API del provider.
7. Confirmar que `payments.status = PAID` y que la orden pasa a `PAID`.
8. Confirmar que la reserva asociada se consume exactamente una vez.
9. Repetir el mismo webhook/evento y confirmar que no existe doble consumo ni doble transición.
10. Ejecutar una prueba de cancelación/rechazo soportada por el provider y confirmar `FAILED`/`CANCELLED` + liberación idempotente de reserva.
11. Verificar que amount, currency, provider y referencia coinciden; cualquier mismatch debe ser rechazado y auditado.
12. Ejecutar/revisar reconciliación server-side usando el identificador real de la transacción.
13. Registrar transaction ID, payment ID, order ID, reservation ID, timestamps y resultado como evidencia de certificación.

### Reglas de seguridad durante la certificación

- Nunca pegar secretos productivos en GitHub, chat, issues, logs o documentos.
- No registrar PAN, CVV, tokens privados ni credenciales completas.
- Utilizar únicamente órdenes creadas para certificación y montos controlados.
- Verificar que el webhook llega al dominio HTTPS de producción.
- No marcar un provider como certificado por el solo hecho de que el checkout abra correctamente.
- El resultado final exige que el ciclo completo provider → webhook → reconciliación → `PAID/FAILED` → reserva sea observable.

### Prerrequisitos técnicos

El despliegue ya dispone de verificación básica de producción mediante `pnpm verify:production`, que comprueba health live/ready y el probe de rate limiting. fileciteturn185file0L2-L2 La certificación de pagos es adicional y no queda cubierta por ese script.

La arquitectura y el flujo documentados arriba son el contrato de certificación; la documentación actual exige evidencia real por provider antes de declarar Fase 04 cerrada. fileciteturn182file0L2-L2

### Criterio de cierre de Fase 04

La Fase 04 se declara **100% certificada en producción** solamente cuando los cinco providers tengan todos los campos obligatorios de la matriz en estado `PASS` y exista evidencia del build/deploy de producción correspondiente.
