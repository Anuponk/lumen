# Événements saisonniers natifs — #1056 / #1057 / #1064

La source de vérité est `src/campaign/seasonal-events.js`. Le catalogue local
définit identifiant, activation, dates civiles (début inclusif, fin exclusive),
fuseau, FR/EN/ES, habillage, célébration et paramètres marketing. L'Avent 2026
est actif du 1er au 24 décembre en Europe/Paris. Le 25 décembre, l'habillage
ordinaire revient automatiquement, sans configuration ni livraison.

Le catalogue ne change ni identifiants, grilles, tentatives, aides, chronomètres,
badges, récompenses ou classements. Le serveur garde l'autorité du vrai défi
quotidien. Les liens datés ouvrent cette grille directement pour les invités.
Après la victoire invitée, une célébration et le temps réalisé précèdent
l’invitation à continuer dans l’application. Sur Android, le bouton ouvre
Google Play pour le package publié `com.nopuna.lumen`. Sur iPhone et iPad,
le lien ouvre LUMEN Web et rappelle l’ajout à l’écran d’accueil depuis Safari.
Sur ordinateur, les deux liens sont proposés. Les liens s’ouvrent dans un
nouveau contexte navigateur, dont le comportement final dépend de Facebook
et du système. La recette physique vérifie cette sortie du navigateur intégré.
Cette étape ne propose plus de compte, de classement ou de retour Mon ciel
dans Facebook. Le parcours invité ne réserve plus de reçu de qualification.
Les joueurs connectés conservent leur fin de défi et leurs classements natifs.
L'événement ne dépend ni de Facebook ni de Metricool. Aucun autre événement
n'est implémenté dans ce chantier.

## Application et prévisualisation

Le contrôleur applique les libellés aux surfaces quotidiennes existantes (menu,
Mon ciel, Social, bandeaux, jeu, résultat, classements). Il préserve les états
calculés comme « déjà joué ». Les guirlandes, les points lumineux et le fond
de Noël sont des couches CSS sans modification des dimensions de la grille. La date
de découverte existante et l'horloge serveur pilotent la présentation ; un
contrôle d'horloge local et le retour au premier plan actualisent l'habillage.
Aucune nouvelle lecture Supabase, aucun stockage joueur ni polling réseau.

Le résultat réutilise les particules de victoire LUMEN avec la palette de
l’événement et respecte `prefers-reduced-motion`. La régression compare les
résultats ordinaires et saisonniers en FR/EN/ES à 360×640.

`/studio/` charge les composants natifs dans un cadre avec une grille
d’initiation et un stockage en mémoire. On peut afficher le jeu, Mon ciel,
la victoire et l’invitation à installer en FR/EN/ES. Les formats mobile,
paysage et ordinateur et la date sont configurables. Le Studio ne crée pas
de client Supabase et bloque les connexions externes. Le Video Studio utilise
ce même écran pour capturer des gestes et la victoire saisonnière.

## Publications et liens

`dailyPresentation(day)` fournit nom, campagne et hashtags. `daily-creative.js`
compose la vraie grille initiale du planning privé pour les visuels officiels
(territoires complets, aucun Gardien, aucune solution). Le dépôt marketing ne
possède aucun calendrier saisonnier de substitution.

Chaque lien `/d/AAAA-MM-JJ/` possède son titre et son aperçu Open Graph statiques.
À cette date de Paris, il mène à `/?daily=1&dailyLink=1`, avec les trois UTM publics
validés. Avant la date, il annonce que le défi n'est pas ouvert. Après la date,
il annonce sa clôture et propose le défi actuel. Il ne prétend jamais rejouer
une ancienne grille. Les anciennes pages `/mini/AAAA-MM-JJ.html` emploient ce
même parcours et ne démarrent plus de mini-jeu indépendant. Les dates invalides
conduisent au diagnostic du répertoire `/d/` sur Apache.

Un post Facebook à 08:00 Europe/Paris par jour, clé `facebook:date` : 31 en
décembre et 31 en janvier. Le 25 décembre et janvier utilisent le défi ordinaire.
Les CSV dérivés au format Metricool comptent 102 colonnes (UTF-8 BOM, textes
multilignes conservés, Facebook uniquement). Le plan associe à chaque date
`official-AAAA-MM-JJ.jpg` dans le lot privé. Les CSV laissent `Picture Url 1`
vide, car Metricool exige une URL publique pour importer un média par CSV.
Après validation du propriétaire, joindre le fichier daté depuis l’appareil,
sans modifier les publications éditoriales. Les aperçus Open Graph publics
emploient un visuel de marque sans grille. Le publieur Meta reste désactivé.

### Préparation et activation du calendrier privé

1. Dans un répertoire local privé hors du dépôt et de la racine Web, exécuter
   `node scripts/marketing/private-daily-plan.mjs --from AAAA-MM-JJ --to AAAA-MM-JJ --output CHEMIN/calendrier.json`.
   Le générateur tire des grilles du catalogue existant, conserve taille et
   difficulté par date, et évite les répétitions dans le lot et les dates déjà
   ouvertes dans le calendrier de référence. Traiter le fichier comme privé.
2. Rendre les JPEG sur boucle locale avec
   `node scripts/marketing/social-visuals.mjs --private-plan=CHEMIN/calendrier.json --output=CHEMIN/visuels`.
   Vérifier le contenu et la liste de dates avant remise au propriétaire.
3. Générer la transaction par `node scripts/marketing/private-daily-plan.mjs --activate CHEMIN/calendrier.json --output CHEMIN/activation.sql`.
   Après autorisation et migration SQL, appliquer la transaction via un canal
   administrateur privé. Elle annule le lot entier si une date est ouverte,
   possède une tentative ou a changé depuis l’instantané de référence.
4. Vérifier que les nombres et les empreintes attendues concordent dans une
   connexion privée. Garder les fichiers hors des PR, journaux et assets de
   déploiement. Les anciennes associations présentes dans l’historique Git
   restent publiques et sont remplacées en base par ces nouvelles associations.

## Vérification et recette

`seasonal-events-tests.mjs` couvre limites horaires, fuseau/DST, désactivation,
trois langues, 62 liens/OG et absence de Gardiens dans les visuels. Le parcours
navigateur quotidien conserve les régressions de reprise et de tentative unique.
Les cas saisonniers vérifient invités et comptes aux 1er/24/25 décembre.
`mini-browser.mjs` couvre liens hérités, trois états de date et aperçu natif isolé.

Chrome local et comptes simulés ne prouvent pas la recette physique. Restent à
valider sur Android installé, PWA iPhone et navigateur intégré Facebook : liens,
affichage compact, langue, consentement et réception réelle des push. Les titres
push nécessitent le déploiement de la fonction Edge modifiée ; ce code ne change
ni drapeaux d'activation ni autorisations privées.

Avant tout import sur le compte payant de Rachel, valider le brouillon et les
doublons avec le propriétaire. Préserver les 15 publications éditoriales de
18h30 et les publications déjà programmées. Aucun outil ne publie ce lot.
