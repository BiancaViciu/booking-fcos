# Law Firm Booking System

This booking system includes:

- Calendar and appointment slot selection
- Personal information and case details form
- Email confirmation to the client
- Email notification to the law firm

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy `.env.example` to `.env` and add your real email/SMTP values.

3. Start the app:

```bash
npm start
```

4. Open:

```text
http://localhost:4242
```

## Notes

Bookings are stored in `data/bookings.json`. For production, replace this file storage with a database.
