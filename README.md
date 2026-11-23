# Kdo 🎁

Les idées cadeaux de la famille, sans gâcher la surprise.

- Chacun tient **sa liste d'idées** (titre, description, liens d'achat, prix, priorité).
- Les listes sont rattachées à des **événements** (Noël, anniversaires…). Une idée non offerte peut être reportée sur l'événement suivant.
- Pour offrir : **j'ouvre l'événement → « Je le prends »** (ou je participe à x %). L'idée est grisée pour les autres quand elle atteint 100 %.
- **Effet surprise** : la personne qui reçoit (enfant ou adulte) ne voit jamais ce qui a été choisi, ni par qui, ni les idées suggérées en secret par les autres.
- Les **parents** créent les comptes de leurs enfants et choisissent qui voit leur liste. Les adultes partagent leur liste avec des **groupes** (« Côté papa », « Cousins »…).

Les règles de gestion complètes sont dans [`docs/regles-de-gestion.md`](docs/regles-de-gestion.md).

## Technique

| Élément | Choix |
|---|---|
| Application | Next.js 16 (App Router, Server Actions), Tailwind CSS 4, installable sur le téléphone (PWA) |
| Données et authentification | Supabase (Postgres + Auth) |
| Sécurité | Toutes les règles (surprise, droits parent/enfant, 100 % max) sont appliquées **dans la base** par des politiques RLS : voir [`supabase/migrations`](supabase/migrations) |
| Hébergement | Vercel + Supabase, offres gratuites |

## Mise en ligne (≈ 15 min, gratuit)

### 1. Supabase

1. Crée un projet sur [supabase.com](https://supabase.com) (région Europe, par exemple Paris).
2. **SQL Editor** → colle le contenu de `supabase/migrations/20261123000000_init.sql` → **Run**.
3. **Authentication → Sign In / Providers** :
   - désactive **Allow new users to sign up** (les comptes se créent uniquement par invitation) ;
   - garde le fournisseur **Email** activé.
4. **Authentication → URL Configuration** : mets l'adresse de ton site (ex. `https://kdo-famille.vercel.app`) dans **Site URL**, et ajoute `https://kdo-famille.vercel.app/auth/confirm` dans **Redirect URLs** (pour « mot de passe oublié »).
5. **Project Settings → API Keys** : note l'URL du projet, la clé *publishable* et la clé *secret*.

### 2. Vercel

1. Importe ce dépôt GitHub sur [vercel.com](https://vercel.com).
2. Ajoute les variables d'environnement (voir `.env.example`) :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `SUPABASE_SECRET_KEY` (**secrète**, côté serveur uniquement)
3. Déploie.

### 3. Premier lancement

1. Ouvre le site : la page **Bienvenue** permet de créer le **premier compte** (uniquement tant que la base est vide).
2. Dans **Famille** : crée un groupe, génère des **liens d'invitation** et envoie-les (WhatsApp, SMS…), ajoute tes enfants.
3. Crée un **événement** (ex. Noël 2026) et coche les personnes qui reçoivent des cadeaux.
4. Sur le téléphone : menu du navigateur → **Ajouter à l'écran d'accueil**.

## Développement local

Prérequis : Node 20+, Docker (pour Supabase en local).

```bash
npm install
npx supabase start          # Postgres + Auth en local (applique les migrations)
cp .env.example .env.local  # puis colle l'URL et les clés affichées par `supabase status`
npm run dev                 # http://localhost:3000
```

### Tests des règles de sécurité

Le fichier `supabase/tests/rls_test.sql` vérifie les règles de gestion directement dans la base (surprise, suggestions secrètes, droits des enfants, dépassement de 100 %, report d'idées, émancipation…). Il tourne sur n'importe quel Postgres 15+ :

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres scripts/test-db.sh
```

### Test de bout en bout

`e2e/scenario.cjs` joue un scénario complet dans un navigateur (premier compte, invitation, enfant, événement, idées, choix, suggestion secrète) et vérifie l'effet surprise. Il nécessite Playwright (`npm i -D playwright && npx playwright install chromium`), une base vide et l'application lancée :

```bash
npx supabase db reset && npm run build && npm start &
node e2e/scenario.cjs
```

## Comptes enfants

Un enfant n'a pas besoin d'e-mail : son parent lui crée un **pseudo** et un **mot de passe** (page Famille → l'enfant). L'enfant se connecte avec ce pseudo. En interne, le pseudo devient une adresse technique `pseudo@enfants.kdo.invalid` (modifiable avec la variable `NEXT_PUBLIC_CHILD_EMAIL_DOMAIN`) ; aucun e-mail n'y est jamais envoyé.
