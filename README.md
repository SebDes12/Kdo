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
| Base de données | Postgres sur Neon, via `pg` |
| Photos des idées | Réduites dans le navigateur (WebP, ~150-300 Ko + vignette ~10 Ko), stockées dans Neon (`idea_images`, plafond 150 Mo), servies par `/idees/[id]/image` avec un cache navigateur d'un an : jamais lues dans les listes |
| Comptes | Gérés par l'application : mots de passe hachés (scrypt), sessions en base, cookie `httpOnly` |
| Sécurité | Les requêtes des utilisateurs s'exécutent sous le rôle `kdo_user` ; toutes les règles (surprise, droits parent/enfant, 100 % max) sont appliquées **dans la base** par des politiques RLS : voir [`db/migrations`](db/migrations) |
| Hébergement | Vercel (région `fra1`) + Neon (Francfort), offres gratuites |

## Déploiement

Le projet Vercel est relié au dépôt GitHub : **chaque fusion dans `main` redéploie le site**.

- La base Neon est connectée au projet Vercel par l'intégration Neon, qui fournit `DATABASE_URL` et `DATABASE_URL_UNPOOLED`.
- Le build lance d'abord `scripts/migrate.mjs`, qui applique les nouveaux fichiers de `db/migrations` (une seule fois chacun, suivis dans la table `schema_migrations`), puis `next build`.

Pour une nouvelle installation : créer un projet Vercel depuis ce dépôt, ajouter une base Neon (Storage → Create Database → Neon), puis déployer. Au premier lancement, la page **Bienvenue** crée le premier compte (uniquement tant que la base est vide). Ensuite, dans **Famille** : groupes, liens d'invitation, enfants.

## Développement local

Prérequis : Node 20+, PostgreSQL 15+.

```bash
npm install
cp .env.example .env.local   # DATABASE_URL vers ta base locale
npm run migrate
npm run dev                  # http://localhost:3000
```

L'utilisateur de `DATABASE_URL` doit posséder la base et avoir le droit `CREATEROLE` (comme le propriétaire d'une base Neon) : la migration crée le rôle `kdo_user`.

### Tests des règles de sécurité

`db/tests/rls_test.sql` vérifie les règles de gestion directement dans la base (sessions, surprise, suggestions secrètes, droits des enfants, dépassement de 100 %, report d'idées, émancipation, liens de mot de passe) :

```bash
PGHOST=localhost PGPORT=5432 PGUSER=postgres npm run test:db
```

### Test de bout en bout

`e2e/scenario.cjs` joue un scénario complet dans un navigateur (premier compte, invitation, enfant, événement, idées, choix, suggestion secrète, mot de passe oublié) et vérifie l'effet surprise. Il nécessite Playwright (`npm i -D playwright && npx playwright install chromium`), une base vide et l'application lancée :

```bash
npm run build && npm start &
node e2e/scenario.cjs
```

## Comptes enfants et mots de passe

- Un enfant n'a pas besoin d'e-mail : son parent lui crée un **pseudo** et un **mot de passe** (Famille → l'enfant). L'enfant se connecte avec ce pseudo.
- Il n'y a **aucun e-mail** : si un adulte oublie son mot de passe, un autre adulte va dans **Famille → Toute la famille → 🔑 Mot de passe** et lui envoie le lien obtenu.
