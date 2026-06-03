# CLAUDE.md — EZEL EXPERT SRL · Aplicație de Property Management

Acest fișier este citit la începutul fiecărei sesiuni. Conține contextul firmei, regulile de business și convențiile tehnice. Respectă-le.

---

## 1. Despre proiect

Aplicație web internă pentru **EZEL EXPERT SRL**, firmă care administrează apartamente în regim de cazare (muncitori firme + persoane pe termen lung). Scopul: centralizarea operațiunilor — apartamente, rezervări, curățenie, lenjerii, mentenanță, pontaj, salarii, facturare/încasări.

- **Scară actuală:** ~60 de apartamente, o singură locație. **Va crește** (alte locații + posibil administrare pentru alți proprietari).
- **Utilizatori:** manageri/asociați (mai mulți), 3–5 angajați. Trebuie să fie ușor de adăugat/scos membri din echipă.
- **Pe termen lung:** rămâne unealtă internă **și** poate deveni produs vândut altor firme (multi-tenant). Scrie codul cu asta în minte (modular, fără hardcodări inutile de date specifice EZEL).

---

## 2. Stack tehnic

- **Frontend:** Create React App (`react-scripts`), **JavaScript simplu** (.js cu JSX), **NU TypeScript**. Stiluri **inline** (nu Tailwind). Paletă: navy `#1F3864`, accente pe stări.
- **Backend/DB:** **Supabase** (PostgreSQL + Storage + Auth custom pe bcrypt prin funcții RPC).
- **Deploy:** **Vercel**, build automat la fiecare push. Branch-ul de lucru/producție: **`main`**.
- **Routing:** react-router. Rutele cer rol: `/admin` (admin), `/curatenie` (curatenie), `/lenjerii` (lenjerii).

### Fișiere cheie
- `src/lib/supabase.js` — stratul de date (toate funcțiile spre DB). **Vezi regula critică #1.**
- `src/lib/auth.js` — login, sesiune (localStorage), `getUser/getNume/getRole`.
- `src/pages/AdminPage.js` — shell-ul de admin: meniu grupat (`NAV_GROUPS`), tab-uri numerice, modale.
- `src/pages/*Tab.js` și `*Page.js` — modulele individuale.

---

## 3. ⚠️ REGULI CRITICE (gotchas — citește înainte de orice modificare)

1. **NU rescrie `src/lib/supabase.js` integral.** Pe `main`, URL-ul Supabase și cheia anon sunt **scrise direct în fișier (hardcodate)**. O înlocuire completă a fișierului le-ar șterge și ar pica aplicația. Dacă ai nevoie de o funcție nouă de date, **adaug-o punctual** sau importă `supabase` în componentă (`import { supabase } from '../lib/supabase'`) — nu regenera fișierul.

2. **Tabela `utilizatori` e blocată pentru scriere directă** (RLS pornit, fără politică — ca să fie protejate parolele). Orice modificare de utilizator se face prin **funcții RPC** (`add_user`, `admin_update_user`, `admin_delete_user`, `admin_set_password`, `change_password`), nu prin `from('utilizatori').update/insert/delete`.

3. **După orice DDL în Supabase** (coloană/tabel/funcție nouă), rulează `notify pgrst, 'reload schema';` altfel PostgREST dă 404 pe noul câmp. SQL-ul îl rulează **omul, manual**, în Supabase → SQL Editor (Claude nu are acces direct la DB). Dă-i scriptul clar.

4. **Validează JSX înainte de commit:** `npx esbuild <fișier> --loader:.js=jsx --bundle=false --outfile=/tmp/x.js` trebuie să spună „Done", fără erori. Verifică și balansul de acolade/paranteze.

5. **Testează în Incognito** după deploy (service worker-ul ține cache).

6. **Restul tabelelor operaționale** au politică RLS „allow all" (sandbox). Securizarea fină e o fază viitoare separată — nu o presupune făcută.

---

## 4. Model de business

### Apartamente
- Tipuri actuale: **1 dormitor** și **2 dormitoare** (vor apărea și altele). Câmp `tip_apt` (ex. `simplu`).
- **2–3 locuri/paturi** în medie.
- Statusuri folosite: **Ocupat**, **Liber**, **Eliberează** (`elib` — arată data eliberării și **programează automat curățenie**), **Special**, **Mentenanță**.
- Acum: apartamente închiriate de EZEL. Viitor: și administrate pentru **alți proprietari** (rol `proprietar` + rapoarte de proprietar — nu e cazul încă).

### Clienți & rezervări
- Clienți: **firme care cazează muncitori** + **persoane pe termen lung**. „Firma" în aplicație = **chiriașul (compania)**.
- Se închiriază de obicei **tot apartamentul**. Perioade **variate**.
- Rezervări mai ales din **telefon/WhatsApp** și **website** (alte locații au site-uri proprii). Sursă în `rezervari.sursa`.
- **Preț:** poate fi pe pat / pe apartament / pe noapte / pe lună — **depinde de client**. Tot așa și **utilitățile** (incluse / sumă fixă / pe consum — depinde de client). Vezi `pret`, `pret_noapte`, `pret_utilitati`, `utilitati_tip`.
- **Garanție la chirie** + **plată în avans pentru firmele noi** (care nu sunt încă în sistemul lor).

### Check-in / check-out
- Făcut de un **angajat** sau **self check-in**. Ore **flexibile** (depind dacă apartamentul a fost ocupat în ziua dinainte și dacă urmează alți clienți după check-out).
- **La check-out → trebuie programată automat curățenie GENERALĂ (obligatorie).**

### Curățenie
- Programarea: **automat la check-out** (+ manual din Planificare curățenie).
- **Tipuri:**
  - **Întreținere** — curățenie la **același client** (în timpul șederii).
  - **Generală** — la **plecarea clientului** (check-out). Obligatorie.
  - **Urgentă** — folosită **foarte rar**.
- **Regulă fermă: un apartament poate fi programat o singură dată pe zi** (deja implementat — blochează a doua programare).
- Angajate la curățenie (acum): **Olar Svitlana**, **Farcas Adela Georgiana**. Program start **07:30**, dar **trebuie să poată fi modificat**.
- **Bonus = 10 lei / apartament curățat**, **împărțit între cele 2 doamne dacă ambele sunt prezente**; dacă e prezentă **doar una**, întreg bonusul merge la ea.
- Numărul de curățenii se calculează **pe zi, pentru ambele persoane** (nu pe persoană individual).

### Reguli de programare a curățeniilor (ghid pentru motorul de planificare)
- **O singură programare per apartament per zi** (deja implementat — blochează a doua).
- **Plafon de 12 curățenii pe zi (soft).** Se poate **depăși** doar pentru curățenii obligatorii: (a) curățeniile **GENERALE** (la check-out — nu se amână) și (b) curățeniile care altfel ar **depăși 10 zile** de la ultima (cadența 7–10 nu se încalcă). Curățeniile de întreținere flexibile se mută în altă zi lucrătoare dacă s-ar depăși 12.
- **Zile nelucrătoare:**
  - Momentan **sâmbătă și duminică NU se lucrează**. Trebuie **buton** care activează/dezactivează lucrul în weekend.
  - La **începutul fiecărui an** se preiau automat **sărbătorile legale din România** și se marchează **nelucrătoare**. Fiecare zi liberă are un **buton** „se lucrează / nu se lucrează" (override manual).
- **Generare săptămânală:** curățeniile pentru **săptămâna următoare** se generează **joi la ora 10:00** (automat), sau printr-un **buton** „Generează săptămâna viitoare". (Există deja `autoScheduler.js` — de extins.)
- **Cadență (interval max între curățenii):** maxim **7–10 zile** de la ultima curățenie. Curățeniile intermediare se distribuie **egal** pe durata șederii ca să respecte acest interval. (Regula 7–10 se aplică **universal** — NU mai există regula separată de 5 zile / termen scurt.)
- **În funcție de durata șederii:**
  - **≤ 15 nopți (inclusiv):** **GENERALĂ** la check-out (mereu) + **buton opțional „curățenie intermediară"** — managerul alege dacă o adaugă; altfel se face doar generala la plecare. (NU se aplică automat la fix 10 nopți; butonul e disponibil până la 15 nopți inclusiv.)
  - **Peste 15 nopți:** curățenii de **ÎNTREȚINERE** programate **automat**, distribuite **egal** pe durata șederii (interval 7–10 zile), + **GENERALĂ** la check-out. Ex.: 15 nopți → opțional o intermediară ~ziua 7 + generală la plecare; peste 15 → intermediare automate.

### Lenjerii / spălătorie
- Spălătoria este **internă** (a firmei).
- Se urmăresc **kg** pentru **control consum**.
- Schimbarea lenjeriei: teoretic **săptămânal** dacă rămân aceiași clienți; dacă un client stă ~10 nopți, se schimbă **doar la check-out** (rar la mijloc).

### Cost curățenie (calcul lunar)
- **Cost/curățenie = (salarii brute + bonusuri + utilități spălătorie + consumabile) ÷ nr. curățenii din lună.** Se calculează **la final de lună**, ca medie pe apartament. (Implementat în modulul Salarii; utilități + consumabile + salarii de bază sunt editabile și salvate per lună în `setari` sub `cost_op:YYYY-MM`.)

### Mentenanță
- Reparațiile: **intern + colaboratori externi**.
- Raportează: doamnele de curățenie, **tu**, și (viitor) **clienții** — se dorește un **cod QR + pagină pentru clienți** prin care raportează problema și trimit mesaj firmei.
- **Prioritatea o decide sistemul automat** din descriere (reguli pe cuvinte-cheie; AI adevărat = fază viitoare).
- **Cost estimat** se poate pune **înainte și după** reparație.

### Pontaj & salarii
- Plata doamnelor: **lunar fix + bonus**.
- **Pauza de masă 12:00–12:30 NU se contorizează** în ore.
- **Clock In/Out necesită aprobare** (pentru întârzieri) — model preluat din restaurantele din US, considerat corect.

### Financiar
- Facturare: prin **SmartBill** (program extern).
- Firmele plătesc prin **transfer bancar** (rar cash). Banca: **Banca Transilvania**.
- **Restanțe: foarte rare.**
- Vis pe termen lung: sistemul **emite factura** (integrare SmartBill) și **preia automat încasările din contul bancar** (Banca Transilvania) — fază mare, viitoare.

---

## 5. Roluri & permisiuni
- `admin` — acces complet (inclusiv Setări; poarta de Setări e pe rol `admin`).
- `property_manager` — administrare proprietăți & rezervări.
- `curatenie` — doar aplicația angajatelor de curățenie.
- `lenjerii` — doar aplicația de lenjerii.
- `financiar` — facturi & rapoarte.
- `proprietar` — doar proprietățile sale (viitor).

> Obiectiv viitor: fiecare **manager** primește **raportul din sectorul lui**.

---

## 6. Model de date (tabele Supabase — verifică schema reală înainte de a te baza)
- `apartamente` — `nr`, `tip`, `firma`, `status`, `plata`, `tip_serviciu`, `curatenie_status`, `ultima_curatenie`…
- `rezervari` — `nr_apt`, `firma`, `data_checkin`, `data_checkout`, `pret`, `pret_noapte`, `pret_utilitati`, `utilitati_tip`, `nr_locuri`, `nr_nopti`, `total`, `status`, `status_plata`, `sursa`, `creat_de`, `contact_*`…
- `curatenie` — `nr_apt`, `data_programata`, `tip_apt`, `firma`, `tip_curatenie` (intretinere/generala/urgenta), `status_curatenie` (programata/in_progres/finalizata), `observatii`, `amanare_status`, `facut_de`, `data_finalizare`, `cost_*`.
- `mentenanta` — `nr_apt`, `firma`, `descriere`, `foto_url`, `status` (nou/in_lucru/rezolvat), `cost_estimat`. (Prioritatea NU e coloană — se calculează live din descriere.)
- `pontaj` — `utilizator_id`, `nume`, `data`, `ora_intrare`, `ora_iesire`.
- `pontaj_cereri` — `utilizator_id`, `nume`, `data`, `tip` (intrare/iesire), `ora_solicitata`, `motiv`, `status` (asteptare/aprobat/respins), `aprobat_de`.
- `lenjerii_comenzi` — `utilizator_id`, `nume`, `locatie`, `data_livrare`, `nr_seturi`, `total_kg`, `status` (asteptare/livrat), `observatii`.
- `spalatorie` — modulul de spălătorie (admin).
- `istoric_firme` — istoric firme pe apartament.
- `setari` — key-value (`id`, `valoare` JSON, `updated_at`). Ex.: `cost_op:YYYY-MM` = {salarii, utilitati, consumabile}; culori; angajați.
- `log_actiuni` — audit log al acțiunilor.
- `utilizatori` (blocată) + view `utilizatori_public` (`id`, `nume`, `rol`, `activ`).
- **Storage bucket:** `mentenanta-foto`.
- **Funcții RPC (bcrypt):** `login_user`, `change_password`, `add_user`, `admin_set_password`, `admin_update_user`, `admin_delete_user`.

---

## 7. Terminologie internă EZEL
- **AP / apart** = apartament.
- **1c/l, 2c/l** = o curățenie pe lună, două curățenii pe lună etc.
- **elib (eliberează)** = apartamentul urmează să fie eliberat; arată data eliberării și se programează automat curățenie.

---

## 8. Convenții de cod & workflow
- Limba aplicației: **română** (texte UI în română, cu diacritice).
- Mesaje către utilizator: scurte, clare, pe înțelesul unui om non-tehnic.
- Modificări pe branch **`main`**; commit cu mesaj descriptiv.
- **Toate patch-urile (`.patch`) se livrează pentru folderul `patch/`** din repo (ex. se aplică cu `git am patch/<nume>.patch`). Numele fișierelor **fără liniuțe** (descărcarea le elimină). Folderul `patch/` e în `.gitignore`.
- Pentru schimbări de schemă: livrează un **script SQL clar**, terminat cu `notify pgrst, 'reload schema';`, pe care îl rulează omul în Supabase.
- Evită over-engineering; preferă soluții simple, robuste, ușor de testat. Verifică build-ul (esbuild) înainte de commit.
- Recalculează valorile (totaluri, costuri) automat în UI; nu cere omului să facă lucruri pe care le poate face sistemul.

---

## 9. Roadmap / obiective (prioritizate de business)
**Cele 3 dureri zilnice de rezolvat (prioritar):**
1. Siguranța că **toate curățeniile sunt programate** — niciun apartament eliberat fără curățenie făcută.
2. Siguranța că **facturile sunt emise și primite** de clienți.
3. Un **raport pe zi / pe săptămână** (acum există doar dashboard pe zi).

**Alte direcții cerute:**
- **Rapoarte per manager** (fiecare manager vede sectorul lui).
- **Pagină + cod QR pentru clienți** ca să raporteze probleme de mentenanță.
- **Motor de planificare curățenie** extins: weekend on/off, sărbători legale RO auto + override, generare automată joi 10:00 pentru săptămâna următoare, plafon **soft** 12/zi (depășibil pentru generale și pentru respectarea intervalului de 10 zile), curățenie intermediară **opțională până la 15 nopți inclusiv**, întreținere **automată** distribuită egal (7–10 zile) peste 15 nopți.
- **Multi-locație** (alte locații în curând).
- **Administrare pentru alți proprietari** (rol proprietar + rapoarte proprietar).
- **Integrare SmartBill** (facturare) + **preluare încasări din Banca Transilvania**.
- **Funcții AI** (ex. prioritizare mentenanță „inteligentă", dynamic pricing, asistent intern) — fază ulterioară.
- Pe termen lung: pregătire pentru **multi-tenant** (produs vândut altor firme).
