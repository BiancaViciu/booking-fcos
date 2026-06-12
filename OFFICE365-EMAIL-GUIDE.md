# Office365 email setup

Use these values in Render > booking-fcos > Environment.

```env
FIRM_EMAIL=bianca.viciu@fcos.co.uk
EMAIL_FROM=Forest & Co <bianca.viciu@fcos.co.uk>
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_REQUIRE_TLS=true
SMTP_USER=bianca.viciu@fcos.co.uk
SMTP_PASS=your_office365_password_or_app_password
SMTP_CONNECTION_TIMEOUT=30000
```

Keep the existing Stripe, SITE_URL and ADMIN_PIN values.

After saving the variables, click Manual Deploy > Deploy latest commit.

If email still fails, check Microsoft 365:

1. Go to Microsoft 365 admin center.
2. Users > Active users.
3. Select `bianca.viciu@fcos.co.uk`.
4. Mail > Manage email apps.
5. Make sure `Authenticated SMTP` is enabled.

Microsoft documents that SMTP AUTH is commonly used by applications that send email and typically uses port 587. It can be enabled per mailbox in Microsoft 365 admin center under Mail > Manage email apps.
