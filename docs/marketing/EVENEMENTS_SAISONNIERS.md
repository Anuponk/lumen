# Événements saisonniers natifs — #1056 / #1057 / #1064

La source de vérité est `src/campaign/seasonal-events.js`. Le catalogue local
définit identifiant, activation, dates civiles (début inclusif, fin exclusive),
fuseau, FR/EN/ES, habillage, célébration et paramètres marketing. L'Avent 2026
est actif du 1er au 24 décembre en Europe/Paris. Le 25 décembre, l'habillage
ordinaire revient automatiquement, sans configuration ni livraison.

Le catalogue ne change ni identifiants, grilles, tentatives, aides, chronomètres,
badges, récompenses ou classements. Le serveur garde l'autorité du vrai défi
quotidien. Les invités jouent sur cette même grille en entraînement non classé.
L'événement ne dépend ni de Facebook ni de Metricool. Aucun autre événement
n'est implémenté dans ce chantier.

## Application et prévisualisation

Le contrôleur applique les libellés aux surfaces quotidiennes existantes (menu,
Mon ciel, Social, bandeaux, jeu, résultat, classements). Il préserve les états
calculés comme « déjà joué ». La décoration utilise un contour intérieur et
une étoile discrète, sans nouvelle section ni réduction de la grille. La date
de découverte existante et l'horloge serveur pilotent la présentation ; un
contrôle d'horloge local et le retour au premier plan actualisent l'habillage.
Aucune nouvelle lecture Supabase, aucun stockage joueur ni polling réseau.

`/studio/` prévisualise l'habillage sur une grille de démonstration de campagne.
Date et langue sont libres. Cette page ne démarre pas le jeu, ne lit pas un
défi futur et n'enregistre aucune tentative ni statistique. Son export SVG porte
la mention démonstration. Le véritable Lumen Video Studio du dépôt marketing
importe le même module depuis une copie propre et épinglée de LUMEN.

## Publications et liens

`dailyPresentation(day)` fournit nom, campagne et hashtags. `daily-creative.js`
compose la vraie grille initiale du planning canonique pour les visuels officiels
(territoires complets, aucun Gardien, aucune solution). Le dépôt marketing ne
possède aucun calendrier saisonnier de substitution.

Chaque lien `/d/AAAA-MM-JJ/` possède son titre et son aperçu Open Graph statiques.
À cette date de Paris, il mène à `/?daily=1`, avec seulement les trois UTM publics
validés. Avant la date, il annonce que le défi n'est pas ouvert. Après la date,
il annonce sa clôture et propose le défi actuel. Il ne prétend jamais rejouer
une ancienne grille. Les anciennes pages `/mini/AAAA-MM-JJ.html` emploient ce
même parcours et ne démarrent plus de mini-jeu indépendant. Les dates invalides
conduisent au diagnostic du répertoire `/d/` sur Apache.

Un post Facebook à 08:00 Europe/Paris par jour, clé `facebook:date` : 31 en
décembre et 31 en janvier. Le 25 décembre et janvier utilisent le défi ordinaire.
Les CSV dérivés au format Metricool comptent 102 colonnes (UTF-8 BOM, textes
multilignes conservés, Facebook uniquement). Aucun import automatique, nouvel
abonnement, API payante ou nouveau cron. Le publieur Meta reste désactivé.

## Vérification et recette

`seasonal-events-tests.mjs` couvre limites horaires, fuseau/DST, désactivation,
trois langues, 62 liens/OG et absence de Gardiens dans les visuels. Le parcours
navigateur quotidien conserve les régressions de reprise et de tentative unique.
Les cas saisonniers vérifient invités et comptes aux 1er/24/25 décembre.
`mini-browser.mjs` couvre liens hérités, trois états de date et aperçu sans jeu.

Chrome local et comptes simulés ne prouvent pas la recette physique. Restent à
valider sur Android installé, PWA iPhone et navigateur intégré Facebook : liens,
affichage compact, langue, consentement et réception réelle des push. Les titres
push nécessitent le déploiement de la fonction Edge modifiée ; ce code ne change
ni drapeaux d'activation ni autorisations privées.

Avant tout import sur le compte payant de Rachel, valider le brouillon et les
doublons avec le propriétaire. Préserver les 15 publications éditoriales de
18h30 et les publications déjà programmées. Aucun outil ne publie ce lot.
