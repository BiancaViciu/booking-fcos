# Ghid simplu pentru website-ul de booking

## 1. Cum vezi website-ul vizual

Pentru a vedea designul, deschide acest fisier:

```text
index.html
```

Dublu click pe `index.html`.

Se va deschide in browser si vei vedea pagina cu calendarul si formularul.

Important: daca deschizi doar `index.html`, vezi website-ul vizual, dar emailurile nu se trimit. Emailurile au nevoie ca website-ul sa ruleze pe un server.

## 1A. Cum pornesti website-ul cu emailuri, fara sa scrii comenzi

Deschide cu dublu click:

```text
START-WEBSITE.command
```

Daca Mac-ul intreaba daca ai incredere in fisier, alege sa il deschizi.

Se va deschide o fereastra si apoi browserul la:

```text
http://localhost:4242
```

Tine fereastra deschisa cat timp testezi website-ul.

Daca fisierul spune ca lipseste Node.js, instaleaza Node.js de aici:

```text
https://nodejs.org
```

Apoi deschide din nou `START-WEBSITE.command`.

## 2. Cum functioneaza emailurile

Cand clientul completeaza formularul:

- clientul primeste email de confirmare
- firma primeste email cu datele cererii
- rezervarea se salveaza ca slot ocupat

Pentru asta trebuie completat fisierul `.env`.

## 3. Ce adrese de email se pun

In `.env`, aceste campuri sunt importante:

```text
FIRM_EMAIL=office@firma-ta.ro
EMAIL_FROM="Numele Cabinetului <office@firma-ta.ro>"
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=office@firma-ta.ro
SMTP_PASS=parola-sau-app-password
```

Explicat simplu:

- `FIRM_EMAIL` este emailul pe care vrei sa primesti cererile de booking.
- `EMAIL_FROM` este numele care apare la expeditor.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` sunt setarile emailului care trimite mesajele.

Pentru acest proiect, emailul firmei este deja completat in `.env`.
Am pus si setarile standard pentru Outlook/Microsoft 365:

```text
FIRM_EMAIL=bianca.viciu@fcos.co.uk
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=bianca.viciu@fcos.co.uk
```

Daca emailul nu este pe Outlook/Microsoft 365, atunci `SMTP_HOST` trebuie schimbat cu serverul corect primit de la furnizorul emailului.

## 4. Daca folosesti Gmail

Nu se pune parola normala de Gmail. Trebuie creat un "App Password" din contul Google.

Exemplu:

```text
FIRM_EMAIL=cabinetulmeu@gmail.com
EMAIL_FROM="Cabinet Avocatura <cabinetulmeu@gmail.com>"
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=cabinetulmeu@gmail.com
SMTP_PASS=app-password-de-la-google
```

## 5. Daca folosesti email de domeniu

Daca ai email de tip:

```text
contact@numefirma.ro
```

atunci firma de hosting sau persoana care ti-a facut emailul iti poate da setarile SMTP.

Cere exact asa:

```text
Am nevoie de SMTP host, SMTP port, SMTP user si SMTP password pentru adresa contact@numefirma.ro.
```

## 6. Ce mai trebuie ca website-ul sa fie public

Pentru ca oamenii sa intre pe website de pe internet, acesta trebuie pus pe un hosting/server.

Varianta simpla:

- website-ul se pune pe un server Node.js
- se completeaza `.env`
- se porneste aplicatia

Fisierul principal este:

```text
server.js
```

## 7. Ce poti testa fara server

Fara server poti vedea:

- designul paginii
- calendarul
- formularul
- cum arata experienta clientului

Fara server nu poti testa:

- trimiterea emailurilor
- salvarea reala a bookingurilor pentru toti clientii
- blocarea sloturilor intre mai multi vizitatori
