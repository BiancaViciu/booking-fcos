# Admin page

Admin URL:

```text
https://booking.fcos.co.uk/admin.html
```

## Render environment variable

Add this in Render:

```text
ADMIN_PIN=choose-a-private-pin
```

Example:

```text
ADMIN_PIN=9384
```

Use something private, not this example.

## What you can edit

For each solicitor, you can edit:

- name
- online available days
- online available times
- in-person available days
- in-person available times

Times can be typed like:

```text
09:00, 10:00, 11:00
```

or one per line:

```text
09:00
10:00
11:00
```

## Important Render note

This admin page saves availability to `availability.json` on the running Render service.

On Render free/basic services, file changes can be lost after redeploys or service resets. For a permanent production admin, the next upgrade should store availability in a database.
