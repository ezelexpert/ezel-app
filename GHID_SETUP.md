# EZEL App — Ghid Setup Complet
## Timp estimat: 30-40 minute

---

## PASUL 1 — Supabase (baza de date)

1. Mergi la **supabase.com** → **Start your project** → conecteaza cu GitHub
2. Click **New project**
   - Name: `ezel-app`
   - Password: alege una puternica (salveaz-o!)
   - Region: `EU West (Ireland)` — cel mai aproape de Romania
3. Asteapta ~2 minute sa se creeze proiectul
4. Mergi la **SQL Editor** (iconita din stanga)
5. Click **New query**
6. Copiaza TOT continutul din fisierul `supabase_schema.sql` si lipeste
7. Click **Run** — vei vedea mesajul "Success"
8. Mergi la **Settings → API**:
   - Copiaza **Project URL** (arata ca `https://xxxxx.supabase.co`)
   - Copiaza **anon public** key

---

## PASUL 2 — GitHub (codul)

1. Mergi la **github.com** → **New repository**
   - Name: `ezel-app`
   - Private (recomandat)
   - Click **Create repository**

2. Pe calculator, in terminal:
```bash
cd ezel-app          # folderul cu codul primit
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/USER/ezel-app.git
git push -u origin main
```

---

## PASUL 3 — Vercel (hosting)

1. Mergi la **vercel.com** → conecteaza cu GitHub
2. Click **Add New → Project**
3. Selecteaza repository-ul `ezel-app`
4. La **Environment Variables**, adauga:

| Key | Value |
|-----|-------|
| `REACT_APP_SUPABASE_URL` | URL-ul din Supabase (pasul 1) |
| `REACT_APP_SUPABASE_ANON_KEY` | Cheia anon din Supabase (pasul 1) |
| `REACT_APP_PAROLA_ADMIN` | parola ta pentru manageri |
| `REACT_APP_PAROLA_CURATENIE` | parola ta pentru angajate |

5. Click **Deploy** — asteapta ~2 minute
6. Vercel iti da un link de forma `ezel-app.vercel.app` — acesta e link-ul final!

---

## PASUL 4 — Testare

Deschide link-ul Vercel:
- Login cu parola admin → trebuie sa vezi toate apartamentele
- Login cu parola curatenie → trebuie sa vezi pagina de curatenie
- Adauga o curatenie si verifica ca apare si in Supabase (Table Editor)

---

## PASUL 5 — Domeniu personalizat (optional, gratuit)

In Vercel → Settings → Domains → adauga un domeniu propriu daca ai.
Altfel, link-ul `ezel-app.vercel.app` functioneaza perfect.

---

## Modificari viitoare

Orice modifici in cod:
```bash
git add .
git commit -m "descriere modificare"
git push
```
Vercel detecteaza automat si redeploy-eaza in 1-2 minute. Nu trebuie sa faci nimic altceva.

---

## Schimbare parole

In Vercel → Settings → Environment Variables → modifica valorile → Redeploy.

---

## Structura proiect

```
ezel-app/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── Calendar.js      # Componenta calendar cu X-uri
│   │   └── Modal.js         # Modal reutilizabil
│   ├── lib/
│   │   ├── supabase.js      # Toate apelurile la baza de date
│   │   └── auth.js          # Autentificare cu token zilnic
│   ├── pages/
│   │   ├── LoginPage.js     # Pagina login
│   │   ├── AdminPage.js     # Pagina manager (toate tab-urile)
│   │   └── CuratenIePage.js # Pagina angajate curatenie
│   ├── App.js               # Router principal
│   ├── index.js             # Entry point
│   └── index.css            # Stiluri globale
├── supabase_schema.sql      # Schema baza de date (ruleaza in Supabase)
├── .env.example             # Template variabile de mediu
├── .gitignore
└── package.json
```

---

## De ce e mai buna decat Apps Script

| | Apps Script | Supabase + Vercel |
|--|--|--|
| Viteza | 2-5 sec/apel | < 200ms |
| Refresh blank | Da | Nu niciodata |
| Date reale | Google Sheets | PostgreSQL real |
| Offline | Nu | Partial (cache) |
| Cost | Gratuit | Gratuit |
| Scalare | Limitat | Usor |
