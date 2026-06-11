# Publicare pe booking.fcos.co.uk

Da, putem folosi:

```text
booking.fcos.co.uk
```

Aceasta este o varianta buna daca `fcos.co.uk` este deja website WordPress.

## Cum functioneaza

Website-ul principal ramane:

```text
https://fcos.co.uk
```

Sistemul de booking va fi separat:

```text
https://booking.fcos.co.uk
```

## Important

GoDaddy WordPress hosting de obicei ruleaza WordPress/PHP, nu aplicatii Node.js.

Aplicatia noastra de booking are nevoie de Node.js pentru:

- salvarea bookingurilor
- trimiterea emailului catre client
- trimiterea emailului catre firma

De aceea, varianta recomandata este:

1. Booking app se pune pe un hosting Node.js, de exemplu Render
2. In GoDaddy DNS se adauga subdomeniul `booking`
3. `booking.fcos.co.uk` trimite catre hostingul unde ruleaza aplicatia

## Ce trebuie schimbat in GoDaddy DNS

In GoDaddy, pentru domeniul `fcos.co.uk`, intri la:

```text
DNS / Manage DNS
```

Apoi adaugi un record pentru:

```text
booking
```

De obicei va fi un `CNAME`, de forma:

```text
Type: CNAME
Name: booking
Value: adresa-data-de-hosting
TTL: Default
```

Valoarea exacta o da hostingul unde punem aplicatia, de exemplu Render.

## Ce trebuie in hosting

La hostingul Node.js se creeaza un Web Service cu:

```text
Build Command: npm install
Start Command: npm start
```

Environment Variables:

```text
PORT=10000
FIRM_EMAIL=biancaaviciu@gmail.com
EMAIL_FROM=Law Firm Booking <biancaaviciu@gmail.com>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=biancaaviciu@gmail.com
SMTP_PASS=app-password-ul-gmail
```

## Ce imi poti trimite

Trimite screenshot cu:

- GoDaddy pentru domeniul `fcos.co.uk`
- pagina `DNS` / `Manage DNS`
- ce records exista acum pentru `fcos.co.uk`
- daca vezi ceva numit `CNAME`, `A`, `www`, `@`

Nu trimite parole sau coduri de autentificare.

## Dupa ce merge

Pe website-ul WordPress principal putem adauga un buton:

```text
Book a consultation
```

care duce la:

```text
https://booking.fcos.co.uk
```
