# Resend email setup

Use this if Office365 SMTP shows `Connection timeout` in Render.

## 1. Create Resend account

Go to `https://resend.com` and create an account.

## 2. Verify a sending domain

In Resend, add a domain or subdomain. Recommended:

```txt
booking.fcos.co.uk
```

Resend will show DNS records. Add those records in GoDaddy, then wait until Resend says the domain is verified.

## 3. Create an API key

In Resend, go to API Keys and create a key.

## 4. Add these variables in Render

Render > booking-fcos > Environment:

```env
RESEND_API_KEY=your_resend_api_key
RESEND_FROM=Forest & Co <no-reply@booking.fcos.co.uk>
FIRM_EMAIL=bianca.viciu@fcos.co.uk
EMAIL_FROM=Forest & Co <no-reply@booking.fcos.co.uk>
```

Keep the existing Stripe, SITE_URL and ADMIN_PIN values.

The old Office365 SMTP variables can stay there, but once `RESEND_API_KEY` exists, the booking site will use Resend first.

## 5. Test

After deploy, open:

```txt
https://booking.fcos.co.uk/admin.html
```

Unlock admin, open `Email test`, then click `Send test email`.
