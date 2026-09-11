# Payment Providers — Fase 04

La plataforma utiliza un puerto único de pagos y adapters independientes. El dominio y la aplicación no dependen de SDKs ni APIs concretas.

## Proveedores soportados

| Provider | Adapter | Checkout/API | Reconciliación | Producción requiere |
|---|---|---|---|---|
| Wompi | `WompiPaymentProvider` | Web Checkout + API | Sí | Public/private/integrity/events secrets |
| Stripe | `StripePaymentProvider` | PaymentIntents + client secret | Sí | Secret + publishable key |
| Mercado Pago | `MercadoPagoPaymentProvider` | Checkout Preferences | Sí | Access token + webhook secret |
| PayPal | `PayPalPaymentProvider` | Orders v2 / CAPTURE | Sí | Client ID + client secret |
| Binance Pay | `BinancePayPaymentProvider` | Merchant API | Sí | API key + secret + certificate SN |

## Selección

El provider activo se selecciona únicamente mediante configuración server-side:

```text
PAYMENT_PROVIDER=WOMPI
PAYMENT_PROVIDER=STRIPE
PAYMENT_PROVIDER=MERCADOPAGO
PAYMENT_PROVIDER=PAYPAL
PAYMENT_PROVIDER=BINANCE_PAY
```

No se permite seleccionar proveedor desde el navegador.

## Credenciales

```text
WOMPI_PUBLIC_KEY
WOMPI_PRIVATE_KEY
WOMPI_INTEGRITY_SECRET
WOMPI_EVENTS_SECRET

STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET

MERCADOPAGO_ACCESS_TOKEN
MERCADOPAGO_WEBHOOK_SECRET

PAYPAL_CLIENT_ID
PAYPAL_CLIENT_SECRET
PAYPAL_WEBHOOK_ID

BINANCE_PAY_API_KEY
BINANCE_PAY_SECRET_KEY
BINANCE_PAY_CERTIFICATE_SN
```

Todos los secretos son server-side. Nunca se guardan en D1, código fuente, respuestas de API ni logs.

## Reglas comunes

1. El importe y moneda se obtienen y validan contra la orden server-side.
2. Cada creación utiliza una clave de idempotencia.
3. La referencia del proveedor se persiste antes de aceptar confirmaciones.
4. La confirmación definitiva proviene del webhook firmado o de una reconciliación server-side.
5. Un redirect de navegador nunca confirma dinero.
6. Eventos duplicados y reordenados son tolerados sin doble consumo de stock.
7. `consumeForOrder()` y `releaseForOrder()` son operaciones idempotentes.
8. Un provider no puede leer ni modificar el payment de otro provider.
9. Las respuestas externas se validan estructuralmente antes de entrar al dominio.
10. No existe provider fake, mock, sandbox-runtime ni respuesta de ejemplo en producción.

## Webhooks

Cada provider mantiene su endpoint y verificación criptográfica específica. No se intenta imponer el esquema de firma de un provider sobre otro.

- Wompi: `transaction.updated` + checksum/properties/timestamp.
- Stripe: `Stripe-Signature` sobre el body raw.
- Mercado Pago: `x-signature` + `x-request-id` + `data.id`.
- PayPal: webhook ID + verificación server-side de mensaje.
- Binance Pay: firma HMAC-SHA512 según el protocolo Merchant API.

## Estados externos

Cada adapter traduce sus estados a:

```text
PENDING
APPROVED
DECLINED
VOIDED
ERROR
```

El dominio solamente conoce `PaymentStatus` y sus transiciones válidas.

## Fuente de verdad

El proveedor es la fuente de verdad del movimiento financiero externo; D1 es la fuente de verdad de la representación interna, auditoría, idempotencia y relación con `order_id`. Las discrepancias se resuelven mediante reconciliación, nunca mediante confianza en el cliente.
