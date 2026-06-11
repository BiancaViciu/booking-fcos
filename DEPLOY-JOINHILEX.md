# Cum pui website-ul live pe joinhilex.co.uk

Website-ul are server pentru emailuri, deci nu poate fi pus ca simplu fisier HTML. Are nevoie de hosting care suporta Node.js.

## Varianta recomandata simpla

1. Domeniul ramane la GoDaddy: `joinhilex.co.uk`
2. Website-ul se pune pe un hosting Node.js, de exemplu Render
3. In Render se pun setarile private de email
4. In GoDaddy se schimba DNS-ul ca domeniul sa arate catre website

## Ce trebuie pregatit

Ai nevoie de:

- cont GoDaddy unde este domeniul `joinhilex.co.uk`
- cont Render
- cont GitHub sau alta metoda de incarcare a codului pe Render
- app password-ul Gmail pe care l-ai creat

## Setarile private care se pun pe hosting

In hosting, la Environment Variables, se pun:

```text
PORT=10000
FIRM_EMAIL=biancaaviciu@gmail.com
EMAIL_FROM=Law Firm Booking <biancaaviciu@gmail.com>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=biancaaviciu@gmail.com
SMTP_PASS=app-password-ul-tau-gmail
```

Nu pune aceste valori intr-un loc public.

## Setari pentru Render

Cand creezi serviciul:

```text
Type: Web Service
Language: Node
Build Command: npm install
Start Command: npm start
```

Dupa ce Render termina, iti da o adresa temporara de forma:

```text
https://numele-aplicatiei.onrender.com
```

Testezi intai pe acea adresa.

## Legarea domeniului joinhilex.co.uk

In Render:

1. Intri in serviciul website-ului
2. Mergi la Settings
3. Cauti Custom Domains
4. Adaugi:

```text
joinhilex.co.uk
www.joinhilex.co.uk
```

Render iti va arata ce DNS records trebuie puse in GoDaddy.

In GoDaddy:

1. Intri la domeniul `joinhilex.co.uk`
2. Mergi la DNS / Manage DNS
3. Adaugi sau schimbi recordurile indicate de Render
4. De obicei va fi un `CNAME` pentru `www`
5. Pentru domeniul principal poate fi un `A record` sau alt record indicat de Render

Important: foloseste exact valorile pe care ti le arata Render, pentru ca pot fi diferite de la un serviciu la altul.

## Ce imi poti trimite ca sa te ghidez

Trimite screenshots, nu parole:

- GoDaddy pagina unde vezi `joinhilex.co.uk`
- GoDaddy pagina `DNS` sau `Manage DNS`
- Render pagina unde iti cere setarile
- Render pagina `Custom Domains`

## Ce sa nu trimiti

Nu trimite:

- parola GoDaddy
- parola Gmail
- app password-ul intr-un screenshot public
- coduri de autentificare

## Nota importanta despre bookinguri

Acum bookingurile se salveaza intr-un fisier `data/bookings.json`.

Pentru test si inceput este ok. Pentru productie serioasa, cel mai bine este sa folosim o baza de date, ca rezervarile sa nu se piarda la redeploy sau mutari de server.
