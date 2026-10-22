# Fournisseurs et transferts — preuves de préparation

Vérification du 22 octobre 2026. Aucun email, secret ou contenu de joueur lu.
Les documents publics ne prouvent pas les paramètres ou l'offre propres au
compte : archiver les documents applicables et vérifier les options avant
publication de la politique finale. Aucun nouveau fournisseur activé ici.

## Resend — messagerie transactionnelle

L'éditeur confirme le 22 octobre 2026 utiliser **l'offre gratuite**. Cette
déclaration est enregistrée dans le manifeste ; elle ne vaut pas contrôle des
options du domaine ou du compte. Les durées publiées pour Free sont donc les
références contractuelles à retenir : 30 jours pour emails/logs et 7 jours pour
sauvegardes. Ces valeurs proviennent du fournisseur, et non d'une rotation
configurée par cette PR. [Politique sécurité](https://resend.com/security).

Preuve technique : `supabase/functions/lumen-auth-mail/index.ts` appelle
`https://api.resend.com/emails`. L'inventaire distant relève `lumen-auth-mail`
ACTIVE, version 14 ; la lecture du code déployé confirme cet endpoint.
L'état ACTIVE ne prouve pas chaque paramètre d'activation du compte.

La [documentation RGPD Resend](https://resend.com/security/gdpr) annonce un DPA
applicable aux comptes, un stockage des données de messages aux États-Unis et
des clauses contractuelles types. Le choix d'une région d'envoi européenne
ne déplace pas ce stockage. Elle annonce 30 jours pour emails/logs en Free,
Pro et Scale et 7 jours de backups ; Enterprise peut différer. Ne pas promettre
une purge anticipée ou un réglage spécifique non contrôlé. Une demande portant
sur un joueur n'est pas une clôture du compte fournisseur.

À contrôler : paramètres de suivi d'ouverture/clics du domaine, demandes
d'effacement spécifiques, copie contractuelle et sous-traitants. Ne pas déduire
de l'absence d'analytics client que le fournisseur ne traite aucun diagnostic.
Références : [DPA](https://resend.com/legal/dpa),
[sous-traitants](https://resend.com/legal/subprocessors).

## Supabase — Auth, base, fonctions

La région `eu-central-1` et le partage d'identité avec SoldeZen sont confirmés
par l'audit de métadonnées. La
[FAQ officielle du 6 octobre 2026](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq)
distingue base/backups régionaux et traitements de support, exploitation et
métadonnées hors région. Elle identifie Supabase Pte. Ltd. (Singapour) comme
sous-traitant principal hors cas Marketplace, avec support/opérations possibles
par l'affiliée américaine ; des clauses contractuelles types sont décrites.

L'offre de l'organisation du projet est **Free**, confirmée par lecture des
métadonnées le 22 octobre, sans changement d'abonnement. La
[documentation des backups](https://supabase.com/docs/guides/platform/backups)
ne permet pas de promettre à ce projet les sauvegardes quotidiennes accessibles
des offres payantes. Les exports privés et copies de récupération restent
à inventorier ; ne pas conclure à l'absence de toute copie fournisseur.

La rétention des backups dépend de l'offre. Ne pas appliquer au joueur les
délais de suppression d'un projet entier : aucun projet partagé ne doit être
supprimé pour exécuter une demande Lumen. À vérifier : contrat réellement
applicable, copies/rétention, restauration après effacement, accès de support
et emplacement des fonctions utilisées. Références :
[DPA](https://supabase.com/legal/customer-resources/data-processing-addendum),
[sous-traitants](https://supabase.com/legal/customer-resources/subprocessor-list).

## o2switch — pages et exploitation web

L'éditeur déclare une **offre payante de base**, sans confirmer son nom exact.
L'offre d'entrée actuelle [Grow](https://www.o2switch.fr/hebergement-debutant/)
annonce des sauvegardes quotidiennes sur 30 jours. Il s'agit d'une référence
d'offre, pas d'une preuve que le contrat historique est Grow. La documentation
[Accès brut](https://faq.o2switch.fr/cpanel/mesures/log-acces-brut/) explique
les options d'archivage des logs ; elle ne prouve pas leur état sur ce compte.
Les objectifs de logs et de copies maîtrisées par l'éditeur sont décrits dans
le [plan d'exploitation](PRIVACY_LOGS_AND_BACKUPS.md).

Hébergeur déclaré par l'éditeur. L'
[accord public de septembre 2026](https://www.o2switch.fr/du-rgpd.pdf)
décrit le rôle de sous-traitant et une localisation en France, sous réserve de
la documentation des offres souscrites. Il ne permet pas de déduire toutes les
durées de logs/backups du compte. Vérifier l'offre, la rotation et les copies
opérateur ; ne pas confondre effacement logique d'une ligne et disparition
de toutes les sauvegardes. [CGV publiques](https://www.o2switch.fr/cgv/).

## Autres destinataires à rapprocher du parcours

Google pour la connexion choisie, messagerie utilisée par le joueur pour une
demande, services push de son navigateur et éventuels outils de support.
L'inventaire navigateur constate deux icônes SVG locales et aucun fichier
police/audio distribué ni URL HTTP externe dans l'entrée/CSS examinées ; cela
ne remplace pas une capture de tous les flux, API/SDK et versions actives.

Un inventaire de sous-traitants n'affirme pas que chaque société listée reçoit
chaque donnée Lumen. Le futur paquet et les options du compte doivent être
rapprochés des définitions de collecte/partage de la feuille Data Safety.
Le dossier n'active ni compte enfant, ni publication Play, ni migration.
