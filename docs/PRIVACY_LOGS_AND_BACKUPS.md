# Logs et sauvegardes — recommandations pour Lumen

État du 22 octobre 2026 : objectifs proposés, **pas des réglages appliqués**.
L'offre Supabase reste Free ; aucun service payant, export réel de base,
copie de joueur, envoi ou changement de compte n'est créé par cette PR.

| Catégorie | Objectif recommandé | Limite actuelle |
|---|---|---|
| Logs de dépannage contrôlés par Nopuna | Rotation glissante à 14 jours | Réglages d'hébergement à vérifier ; ne pas confondre avec traces de sécurité |
| Traces d'accès administrateur et événements de sécurité | 6 mois, accès restreint, revue mensuelle des accès | Journal dédié et réglages à qualifier, aucune nouvelle collecte activée ici |
| Copies de restauration contrôlées par Nopuna | Une sauvegarde cohérente quotidienne, 14 générations glissantes chiffrées, copie distincte du service actif | À mettre en place sur une destination déjà disponible et privée ; ne pas créer de stockage payant sans accord |
| Test de restauration | Mensuel et avant une migration importante, sur environnement jetable | Ne jamais restaurer un projet partagé pour tester une seule application |
| Resend Free | Délais fournisseur : emails/logs 30 jours, backups 7 jours | Offre confirmée par l'éditeur ; réglages spécifiques du compte non contrôlés |
| o2switch | Garder le cycle fournisseur réellement inclus ; Grow annonce 30 jours | Offre exacte à confirmer, ne pas promettre un raccourcissement du cycle fournisseur à 14 jours |

Les 14 jours de dépannage sont un choix proportionné proposé pour diagnostiquer
les erreurs courantes, sans conserver un historique de navigation indéfini.
Les journaux de sécurité servent une finalité différente : la
[CNIL recommande une référence de 6 mois à un an](https://www.cnil.fr/fr/securite-tracer-les-operations).
Retenir ici 6 mois comme cible, à justifier selon les événements effectivement
collectés ; une obligation légale ou un incident documenté peut nécessiter un
traitement distinct. Ne pas transformer cette référence en règle universelle.

## Contenu minimal des logs

Conserver horodatage, composant, code d'erreur et identifiant technique limité
au besoin. Pour les actions d'administration, conserver l'acteur habilité,
l'action et son résultat sans copier la donnée traitée. Ne jamais enregistrer
mot de passe, lien magique, code OAuth, JWT, cookie, en-tête Authorization,
contenu d'email, sauvegarde complète ou résultat d'export des droits. Retirer
les paramètres d'URL et corps de requête sensibles ; minimiser IP et agent
navigateur selon la finalité. Les logs bruts du serveur peuvent déjà contenir
des URL complètes : vérifier avant de les copier ou de les archiver.

Dans cPanel : examiner les options de la rubrique Mesures → Accès brut et les
archives réellement présentes. Ne pas considérer qu'une case cochée configure
une rotation de 14 jours. Les journaux fournisseur peuvent suivre d'autres
délais ou obligations. [Guide o2switch](https://faq.o2switch.fr/cpanel/mesures/log-acces-brut/).

## Restauration cohérente et demandes d'effacement

Une copie doit inclure les données et métadonnées nécessaires à la cohérence
Lumen, notamment reçus, règles/version, schéma et protection anti-résurrection.
L'export d'accès/portabilité n'est pas une sauvegarde restaurable. Une sauvegarde
locale dans le navigateur n'est pas une copie serveur indépendante.

Avant restauration, disposer du registre **le plus récent** des effacements et
des barrières, contrôlé séparément des anciennes copies. Réappliquer les
effacements et conserver les protections avant toute réouverture aux clients.
Si ce registre n'est pas disponible, ne pas rouvrir un ancien état susceptible
de réintroduire des comptes effacés. Conserver accès privé, chiffrement et
intégrité du registre : ses empreintes sont des données pseudonymisées.

Le test mensuel vérifie restauration d'un joueur fictif, reçus et solde exacts,
reprise hors ligne, exclusion des comptes effacés, et isolation avec SoldeZen.
Les exports complets peuvent inclure Auth/SoldeZen : ne pas les déposer dans un
chat, le dépôt, un aperçu public ou un environnement de test partagé. Sur Free,
ne pas annoncer de restauration quotidienne gérée incluse si elle n'existe pas.

Une copie quotidienne implique jusqu'à 24 h de perte possible entre deux
copies ; les données persistées restent le service actif, pas ces copies.
L'objectif de reprise et la fréquence doivent être réévalués avec le volume
et l'usage réel. Aucun export ou effacement réel n'est exécuté par ce document.

Références : [Resend](https://resend.com/security),
[Grow](https://www.o2switch.fr/hebergement-debutant/),
[Supabase backups](https://supabase.com/docs/guides/platform/backups).
