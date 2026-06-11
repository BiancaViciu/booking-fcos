# Stripe links and availability

## Consultation options

The booking form now supports:

- Online or in-person appointment
- 15 minute consultation
- 30 minute consultation
- Consultant selection

## Pricing

```text
15 minutes: £140 + VAT
30 minutes: £280 + VAT
```

## Stripe Checkout

This version uses Stripe Checkout Sessions and a Stripe webhook.

The booking is not confirmed when the client submits the form. It is first saved as `awaiting_payment`.

The booking becomes `confirmed` only after Stripe sends a `checkout.session.completed` webhook to the server.

Add these Environment Variables in Render:

```text
SITE_URL=https://booking.fcos.co.uk
STRIPE_SECRET_KEY=sk_live_or_test_key_here
STRIPE_WEBHOOK_SECRET=whsec_webhook_secret_here
STRIPE_CURRENCY=gbp
VAT_RATE=20
STRIPE_VAT_TAX_RATE_ID=txr_optional_vat_tax_rate_id
PAYMENT_HOLD_MINUTES=30
```

Webhook endpoint:

```text
https://booking.fcos.co.uk/api/stripe-webhook
```

Webhook event:

```text
checkout.session.completed
```

If `STRIPE_VAT_TAX_RATE_ID` is set, Stripe shows VAT as tax on top of the base price.

If `STRIPE_VAT_TAX_RATE_ID` is not set, the app charges the VAT-inclusive total:

```text
15 minutes: £168
30 minutes: £336
```

## Availability

Availability is controlled in:

```text
availability.json
```

Example:

```json
{
  "online": {
    "weekdays": [1, 2, 3, 4, 5],
    "times": ["09:00", "10:00", "11:00", "13:00", "14:00", "15:00"]
  },
  "inPerson": {
    "weekdays": [2, 3, 4],
    "times": ["10:00", "11:00", "14:00", "15:00"]
  }
}
```

Weekdays use numbers:

```text
0 = Sunday
1 = Monday
2 = Tuesday
3 = Wednesday
4 = Thursday
5 = Friday
6 = Saturday
```

## Important note

This setup is the correct paid-booking flow: booking confirmation and email sending happen only after Stripe confirms payment.
