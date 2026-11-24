# Kdo : règles de gestion (v1.0)

> Toutes les règles ci-dessous ont été validées.

## 1. Comptes et rôles

| Règle | Statut |
|---|---|
| Un adulte s'inscrit via un **lien d'invitation** (e-mail + mot de passe). | ✅ |
| Un **parent crée le compte de son enfant**. L'enfant peut avoir un login ou non. | ✅ |
| Un enfant peut avoir **plusieurs parents gestionnaires** (les deux parents ont les mêmes droits). | ✅ |
| Mot de passe oublié (adulte) : un **autre adulte de la famille** génère un lien de réinitialisation (valable 2 jours, une seule fois) et le lui envoie. Enfant : son parent change le mot de passe. | ✅ |
| Un parent peut **émanciper** le compte de l'enfant, qui devient alors adulte : il gère sa visibilité et perd l'accès aux réglages parentaux. | ✅ |
| Un parent peut ajouter, modifier et supprimer les idées de son enfant. | ✅ |

## 2. Groupes et visibilité

| Règle | Statut |
|---|---|
| Tout adulte peut créer un **groupe** (« Côté papa », « Cousins »…) et y ajouter des membres ; une invitation peut faire rejoindre **plusieurs groupes**. | ✅ |
| Les idées rattachées à un événement sont visibles par **tous les membres des groupes de l'événement** (sauf la personne qui les reçoit). Il n'y a pas de réglage de visibilité personne par personne. | ✅ |
| Un **enfant** fait partie des groupes **choisis par son parent** (à sa création, il rejoint les groupes du parent). | ✅ |
| Un parent voit toujours la liste de son enfant, réservations comprises. | ✅ |
| Un nouveau membre d'un groupe voit aussitôt les événements de ce groupe ; un membre retiré ne les voit plus. | ✅ |

## 3. Événements

| Règle | Statut |
|---|---|
| Un événement a un nom, une date et est rattaché à **un ou plusieurs groupes** (choisis parmi ceux de son créateur). | ✅ |
| Chaque membre de ces groupes peut y rattacher **sa liste d'idées** ; pour un anniversaire, seule la personne fêtée le fait en pratique (si d'autres le font, ce n'est pas gênant). | ✅ |
| Une idée appartient à **un seul événement actif** à la fois. | ✅ |
| Une fois la date passée, l'événement est **archivé**. Les idées non offertes peuvent être **rattachées à un nouvel événement**. | ✅ |
| Quand une idée partiellement financée est reportée, elle **repart à 0 %** (les participations restent dans l'historique de l'ancien événement). | ✅ |
| Un événement a une **période** (début → fin) ; on peut y choisir des cadeaux jusqu'à la date de fin. | ✅ |
| Qui crée un événement : tout adulte membre du groupe, ou seulement les **administrateurs** si le groupe l'a réglé ainsi. | ✅ |
| Qui modifie ou supprime un événement : son créateur et les **administrateurs** de ses groupes (créateur du groupe + ceux qu'il nomme). | ✅ |
| Un événement supprimé va dans la **corbeille** : restaurable 30 jours (avec les choix déjà faits), puis effacé ; ceux qui y avaient choisi un cadeau sont prévenus. | ✅ |
| Chaque événement indique **qui l'a créé et qui l'a modifié**. | ✅ |

## 4. Idées cadeaux

| Règle | Statut |
|---|---|
| Champs : **titre** (obligatoire), **description**, **1 à N liens d'achat**. | ✅ |
| Champs optionnels : prix indicatif, priorité (★), image. | ✅ |
| Chacun peut ajouter des idées **sur sa propre liste**. | ✅ |
| Tout membre d'un événement peut **suggérer une idée** pour quelqu'un de cet événement. Le **destinataire ne la voit jamais**. | ✅ |
| Le destinataire peut modifier ou supprimer ses idées à tout moment, **sans notification** aux acheteurs. | ✅ |

## 5. Choix et participation

| Règle | Statut |
|---|---|
| Une personne peut choisir **plusieurs idées** sur une même liste. | ✅ |
| On peut prendre **100 %** d'une idée ou **une part en % libre** (par exemple 30 %). | ✅ |
| Les autres voient une **barre de progression** (« 70 % pris ») et le nom des participants. | ✅ |
| L'idée est **grisée** quand le total atteint 100 %. On ne peut pas dépasser 100 %. | ✅ |
| On peut **modifier ou annuler sa participation** jusqu'à la date de l'événement. | ✅ |
| Une idée est marquée **« offerte »** quand l'événement est archivé et qu'elle est à 100 %. | ✅ |

## 6. Effet surprise (règle absolue)

| Règle | Statut |
|---|---|
| Le **destinataire**, enfant **comme adulte**, ne voit jamais : l'état choisi ou non de ses idées, les participants, les pourcentages, ni les idées suggérées par d'autres. | ✅ |
| Cette règle est appliquée **côté serveur** (base de données), pas seulement masquée dans l'interface. | ✅ |

## 7. Ergonomie

- Parcours « offrir » : **j'ouvre l'événement → je vois les listes → je clique « Je prends » (100 % ou x %) → c'est fait.**
- Parcours « ma liste » : **+ Ajouter une idée** → titre, lien(s), description → enregistré.

## 8. Technique

| Choix | Statut |
|---|---|
| Web responsive installable sur le téléphone (PWA). | ✅ |
| Next.js sur Vercel et Neon (Postgres avec sécurité par ligne), en offre gratuite. Comptes et sessions gérés par l'application, stockés dans la base. | ✅ |
| Aucune notification par e-mail. | ✅ |
