# Audit de confidentialité et juridique — #316

État du 22 octobre 2026, base `6dc1a09`, complété par les changements de cette
branche. Les constats de code et les métadonnées de schéma ont été examinés ;
aucun contenu de profil joueur, compte réel ou secret n'a été extrait. Les bases
légales proposées et les politiques de conservation doivent être validées par
l'éditeur avant publication. Cette préparation ne vaut pas certification juridique.

## Registre proportionné des traitements

| Traitement / données observées | Finalité et base à examiner | Stockage / conservation constatée et action |
|---|---|---|
| Supabase Auth : identité email/fournisseur, sessions | Connexion et récupération, service demandé ; spécificités parent/enfant à valider | Projet partagé avec SoldeZen, région `eu-central-1` confirmée. Ne pas supprimer l'identité globale pour une simple demande Lumen |
| `lumen.users`, `profiles`, `progress`, `profile_snapshots`, `historical_performance` | Profil et restauration des acquis ; exécution du service à examiner | Conservation fonctionnelle existante ; durée d'inactivité à définir et suppression à tester |
| `engagement_state`, `daily_progress`, `entitlements`, ledger et autorités/reçus dans `lumen_commands` | Progression, droits et idempotence nécessaires au service | Ne pas traiter les reçus comme de simples logs expirables. Exception de conservation après demande à justifier, pas inventée |
| `analytics_events` : acteur, session, événements et propriétés de tentative | Mesure d'usage optionnelle ; pas d'exemption de consentement démontrée | La base contient des événements historiques ; pas de purge autorisée dans ce chantier. Nouveaux envois/statistiques et stockage session/referral bloqués par défaut dans cette branche |
| `difficulty_ratings`, `feedback` : appréciation, message, contexte et user-agent | Retour volontaire/support ; minimisation et information à examiner | Le client envoie `p_board_state: null` ; audit existant du RPC le neutralise. Durée des messages et données historiques à définir |
| `social_challenges`, `social_challenge_participations` : pseudo, acteur et résultat | Défi demandé par le joueur | Examiner affichage des pseudos, participants, durée et suppression/anonymisation. Contrôle parental et sécurité des enfants ouverts |
| `public.lumen_push_subscriptions` : endpoint, subscription, acteur, opt-in et fuseau | Notifications choisies | Désactivation existante ; durée après inactivité et suppression des endpoints à vérifier. Adaptation native non faite |
| `public.lumen_sync_health`, `lumen_commands.outbox_health` | Diagnostic technique de fiabilité, distinct des statistiques produit | Outbox confirmées >30 jours : fonction et cron de rétention livrés par #523. Ce délai ne s'applique pas aux autres tables ; incidents non résolus conservés |
| `lumen.recovery_backups`, `public.lumen_admin_player_snapshot` | Récupération et exploitation autorisée | Copies/données dérivées à inclure dans la demande d'effacement et l'audit d'accès ; rétention à définir |
| localStorage, IndexedDB, Cache API | Partie locale, cache, intentions durables, session et préférences | L'effacement navigateur peut perdre le non-confirmé. La page de demande n'efface aucun store ; distinguer suppression demandée et réinitialisation de jeu |
| Hébergeur, CDN et fonctions mail/push | Livraison, sécurité, Auth et notifications | o2switch confirmé. Durées des logs et sous-traitance/transferts à obtenir ; ne pas promettre que tous les traitements restent dans l'EEE |

Les tables de règles/catalogue n'identifient pas à elles seules un joueur.
Les tables d'exclusion analytics et les capacités internes doivent néanmoins
être vérifiées lorsqu'elles sont liées à un acteur. Ne pas oublier les caches
de cockpit, exports de récupération, sauvegardes et leurs éventuels délais de purge.

## SDK et flux observés

| Composant | Source / preuve | État |
|---|---|---|
| Supabase JS | `index.html`, URL jsDelivr `@supabase/supabase-js@2` | Version majeure flottante ; figer et qualifier une version avant packaging. Auth/DB, pas un SDK publicitaire |
| QRCode JS | `index.html`, cdnjs `qrcodejs/1.0.0` | QR du partage ; vérifier licence et embarquement local au packaging |
| Web Push / service worker | UI, `sw.js` et endpoint de push existant | Permissions/opt-in distincts des analytics ; aucune installation FCM native |
| Fonts et ressources externes | CSS/HTML et manifeste à recontrôler sur paquet final | Inventaire réseau de l'AAB nécessaire, notamment requêtes CDN et logs d'accès |
| Publicité / paiement | Aucun SDK AdMob, publicitaire ou Play Billing identifié dans les surfaces examinées | Première version gratuite sans pub/achats confirmée ; ne pas déclarer un futur SDK comme déjà audité |

Le projet Supabase partage des ressources avec d'autres applications. La région
de la base ne décrit pas à elle seule les lieux de traitement des emails,
CDN, support, journaux et sous-traitants. Obtenir les DPA/liste de sous-traitants
et garanties de transferts des fournisseurs au lieu de déduire l'absence de transfert.

## Correction des analytics optionnels

Reproduction avant correction : le test envoie `session_start` et un referral
sans accord ni fournisseur de permission ; deux appels fictifs sont observés.
Après correction, le module exige `analyticsAllowed() === true`, vérifié pour
chaque envoi et referral. Absence, refus ou erreur : aucun envoi et aucune
création/lecture de session analytics ou écriture du referral.

L'application ne fournit actuellement aucun tel accord : ces statistiques
restent désactivées pour la préparation familiale. Le test d'équivalence des
anciens payloads est conservé avec permission explicite en fixture seulement.
La télémétrie de synchronisation nécessaire n'est pas assimilée à l'analytics produit.

L'identifiant `lumenAnonymousIdV1` reste utilisé par les fonctions existantes de
défi, feedback, notifications et rapprochement historique ; il n'est pas une
preuve d'accord statistique. Sa création anticipée et ces fonctions doivent
être revues au titre du parcours enfant et de la minimisation. Le changement
n'efface pas rétroactivement les événements ni les identifiants des anciennes versions.

Pas de bannière d'acceptation fictive : aucune option ne réactive la collecte
avant conception d'un mécanisme de permission approprié, notamment parental.
Si une collecte optionnelle est réintroduite, prévoir refus/retrait simples,
preuve datée/versionnée et contrôle du SDK avant émission, puis tests dédiés.

## Éditeur et pages juridiques

Informations fournies par le propriétaire : Nopuna ; Cédric Valente EI ; SIREN
897 865 747 ; SIRET 897 865 747 00025 ; contact dans `content/legal/publisher.json`.
Les numéros passent le contrôle de format/cohérence ; cela ne constitue pas une
vérification de l'activité déclarée ou de ses obligations fiscales/sociales.

L'adresse et le téléphone de publication ne sont pas choisis. Ils sont publics
dans les mentions ; utiliser des coordonnées professionnelles officielles
validées par le propriétaire. Le nom commercial ne remplace pas l'identité EI.
La relecture actuelle de `nopuna.fr` et du dépôt `nopuna-studio` n'a pas permis
d'y retrouver les mentions/SIREN ; les numéros ci-dessus viennent de l'utilisateur.
Ne pas recopier une adresse privée trouvée ailleurs.

Hébergeur : o2switch, Chemin des Pardiaux, 63000 Clermont-Ferrand, téléphone
04 44 44 60 40, selon sa propre page d'information. Confirmer les mentions à la
date de publication. Le détail RNE/RCS et la situation TVA restent à vérifier.

Préparer des mentions légales et une politique de confidentialité finales
accessibles en HTML public, avec identité/contact, catégories, finalités, bases,
destinataires, durées, droits et transferts. Ne pas publier un texte qui promet
une durée ou une suppression non exécutée. La page `supprimer-compte.html` est
un canal de demande, pas une politique complète ni une preuve d'effacement.

## Droits et suppression

Contact utilisateur : accès, rectification, effacement, opposition et portabilité
selon leur applicabilité. Préparer le traitement et la réponse dans les délais
applicables, avec vérification proportionnée de l'identité et du représentant
légal ; ne pas demander systématiquement de pièce d'identité ou de mot de passe.
Procédure : [ACCOUNT_DELETION_RUNBOOK.md](ACCOUNT_DELETION_RUNBOOK.md).

Le propriétaire doit valider l'exécution, la politique de rétention et les
exigences professionnelles ambiguës. Ne pas annoncer « suppression vérifiée »
sur la seule base d'un email préparé ou d'une désactivation de compte.

## Préparation Data Safety — non soumise

| Catégorie à examiner dans la Console | Preuve applicative / état |
|---|---|
| Email et identifiants de compte/utilisateur | Auth, profils et identifiants pseudonymes ; collecte fonctionnelle à déclarer selon le paquet final |
| Activité dans l'app / interactions et progression | Sauvegarde et défis ; analytics historiques et collecte future optionnelle à distinguer |
| Contenu utilisateur | Pseudos, feedback et performances partagées, selon fonctions accessibles dans le parcours familial |
| Informations appareil / diagnostics | User-agent du feedback, version/plateforme des diagnostics et logs des fournisseurs à qualifier |
| Notifications | Endpoint et subscription associés au joueur, permissions et retrait |
| Publicité / achats | Absents de la première version choisie ; ne pas intégrer ni déclarer Billing par anticipation |

La qualification collecte/partage, traitement par prestataire, caractère
facultatif, chiffrement et effacement doit être rapprochée du trafic de l'AAB
réel et des contrats. Ne pas cocher « aucune donnée collectée » parce que les
analytics sont désactivés : compte et sauvegardes restent des traitements.

## Points bloquants spécifiques aux enfants

La cible confirmée comprend des enfants. Google Families s'applique et demande
une évaluation des SDK, de l'authentification et des fonctions sociales. Le jeu
invité fonctionne déjà, mais les sollicitations de compte, pseudonymes, partage,
feedback et notifications n'ont pas encore de parcours parental démontré.

Avant de déclarer cette cible prête : choisir un parcours enfant/parent,
contrôler les conditions des fournisseurs et empêcher les traitements non
autorisés ; déterminer les tranches réellement appropriées et vérifier le
questionnaire de contenu. Un simple « j'ai plus de 15 ans » n'est pas une
vérification parentale universelle ni une solution internationale.

## Gratuité, propriété intellectuelle et activité EI

Pas de CGV de vente, de contrat publicitaire ou d'abonnement fabriqué pour des
services absents. Toute activation future doit rouvrir l'audit consommation,
facturation/TVA et Google Play Billing approprié. La gratuité n'efface pas les
obligations sur le service numérique, la confidentialité et les mineurs.

Les sources/licences astronomiques existantes sont dans
[ASTRONOMY_DATA_ATTRIBUTION.md](ASTRONOMY_DATA_ATTRIBUTION.md). Compléter la revue
des autres visuels, sons, polices et dépendances ; vérifier la disponibilité du
nom/marque avant d'en revendiquer l'exclusivité. L'immatriculation fournie ne
prouve pas que l'édition de jeux est déjà couverte : confirmation professionnelle
du périmètre EI et des points fiscaux/socials nécessaires avant soumission.

## Sources et preuves à maintenir

Sources officielles consultées le 22 octobre 2026 :

- [Mentions de l'éditeur](https://www.economie.gouv.fr/entreprises/developper-son-entreprise/innover-et-numeriser-son-entreprise/mentions-sur-votre-site-internet-les-obligations-respecter).
- [Cookies et traceurs](https://entreprendre.service-public.gouv.fr/vosdroits/F31228).
- [Mesure d'audience et exemption à évaluer](https://www.cnil.fr/fr/cookies-solutions-pour-les-outils-de-mesure-daudience).
- [Données et politique Google Play](https://support.google.com/googleplay/android-developer/answer/10144311).
- [Suppression de compte](https://support.google.com/googleplay/android-developer/answer/13327111).
- [Families](https://support.google.com/googleplay/android-developer/answer/9893335?hl=fr).
- [Coordonnées o2switch](https://blog.o2switch.fr/que-renseigner-dans-la-page-mentions-legales/).

Les tests locaux, pages publiées, captures, contrats fournisseurs et déclarations
Console doivent être conservés avec date, version et limites. Aucune suppression
réelle, inscription Console, publication, migration ou nouvelle ressource payante
n'a lieu dans cette préparation. #316 reste bloquante avant Google Play.
