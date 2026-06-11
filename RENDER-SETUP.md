# Render setup pentru booking app

## Ce faci in Render

1. Intra pe:

```text
https://render.com
```

2. Creeaza cont sau logheaza-te.

3. Apasa:

```text
New
```

4. Alege:

```text
Web Service
```

5. Daca Render cere codul din GitHub, creeaza un repository nou in GitHub si incarca fisierele din acest folder.

## Setari pentru Web Service

Completeaza asa:

```text
Name: booking-fcos
Language: Node
Branch: main
Root Directory: lasa gol, daca repository-ul contine direct aceste fisiere
Build Command: npm install
Start Command: npm start
```

La plan poti alege varianta gratuita pentru test, daca este disponibila.

## Environment Variables

In Render, cauta sectiunea:

```text
Environment Variables
```

Adauga aceste valori:

```text
FIRM_EMAIL=biancaaviciu@gmail.com
EMAIL_FROM=Law Firm Booking <biancaaviciu@gmail.com>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=biancaaviciu@gmail.com
SMTP_PASS=app-password-ul-gmail
```

Pentru `SMTP_PASS`, pune app password-ul Gmail creat de tine.

Nu pune parola normala de Gmail.

## Dupa deploy

Render iti va da un link de forma:

```text
https://booking-fcos.onrender.com
```

Deschide linkul si testeaza formularul.

## Apoi legam domeniul

Dupa ce linkul Render merge, mergem in:

```text
Settings > Custom Domains
```

Adaugam:

```text
booking.fcos.co.uk
```

Render iti va arata ce DNS record trebuie pus in GoDaddy.

De obicei va fi:

```text
Type: CNAME
Name: booking
Value: ceva.onrender.com
TTL: 1/2 Hour
```

Foloseste exact valoarea afisata de Render.
