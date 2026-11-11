# Temps officiel : plan de livraison #638 / #652

La migration `20261111133853_official_attempt_time.sql` ajoute des fonctions et
étend les commandes existantes. Elle ne réécrit aucun profil, score, reçu,
badge ou portefeuille existant. Son application en production est distincte de
la fusion du client et nécessite la validation des impacts ci-dessous.

## Sémantique vérifiée

| Donnée | Signification | Traitement |
| --- | --- | --- |
| attempt.activeDuration, facts.seconds | durée réellement jouée | conservée |
| attempt.helpUses / facts.timing.helpUses | nombres cumulatifs d’aides | restaurés, jamais recrédités |
| ranking_scores.seconds | durée réelle compétitive | jamais présentée comme record officiel |
| ranking_scores.penalty | pénalité déjà calculée | conservée, pas ajoutée deux fois |
| ranking_scores.score | durée officielle déjà pénalisée | utilisée directement |
| bestTime/time/bestUnassistedTime | anciens minima techniques | conservés |
| officialTimes[revision] | minimum officiel de cette révision | minimum indépendant par révision |

Le 11 novembre 2026, l’audit de production **en lecture seule** a recensé
2 019 résumés, dont 1 262 minima réels : 968 liés à la révision originale et
294 à une révision dont l’ancien minimum n’est pas prouvé. Dix minima réels
correspondent au brut d’un score compétitif pénalisé. Aucun champ officialTimes
n’existe encore ; le profil le plus volumineux mesure 311 190 octets.
Ces nombres sont une observation datée, pas des constantes applicatives.

La projection historique privée ne dépend ni du pseudo ni de la participation
publique. Elle lit les données existantes sans les modifier. Une nouvelle
victoire convertit paresseusement son seul résumé sous le verrou transactionnel
existant. L’ancien reçu reste inchangé ; le nouveau reçu conserve les compteurs
et le précédent record officiel comparable. La conversion est idempotente.

Un ancien minimum original est considéré sans aide, sauf s’il est identifié
comme le brut d’un score compétitif pénalisé : dans ce cas, seul le score
officiel et un éventuel minimum sans aide prouvé sont comparables. Les minima
de révision ambiguë restent conservés et ne sont pas comparés à une autre grille.
Aucun classement historique n’est publié par cette migration.

L’import historique existant exclut ensuite les minima bruts des résumés déjà
versionnés. Il utilise leur précédent record comparable, figé dans le premier
reçu versionné de cette quête. Les nouveaux minima réels ou officiels acquis
après conversion ne peuvent donc pas devenir artificiellement des performances
historiques à pénalité nulle, ni contourner l’admission du classement.

## Prérequis et ordre opérateur

1. Refaire l’audit agrégé et vérifier les versions de fonctions attendues,
   `quest_rules.grid_revision`, les limites de profil et les migrations précédentes.
   `20261111060216_highscore_victory.sql` est un prérequis : au dernier audit,
   sa vue d’import et ses colonnes de profil ne sont pas encore en production.
   Le plan Highscore existant reste applicable avant la migration du chrono.
2. Exporter de manière privée et vérifiée les définitions `pg_get_functiondef`
   de commit_legacy, commit_quest, recover_performance et ranking_finish, la
   définition de ranking_history_candidates, leurs
   ACL, ainsi que les snapshots/autorités/reçus et scores. L’export contient des
   données personnelles : il ne doit jamais entrer dans Git ni les logs CI.
   Vérifier la restauration dans une base isolée et conserver les empreintes.
3. Obtenir la validation opérateur pour le changement serveur. Les fixtures SQL
   sont strictement réservées à PostgreSQL jetable ; ne jamais les appliquer à
   Supabase production.
4. Appliquer la migration transactionnelle. Les gardes de source arrêtent tout
   corps inattendu. Elle peut être rejouée sans doubler ses injections.
5. Vérifier capability, projection privée, types/compteurs/révisions refusés,
   victoire répétée, restauration et score sur comptes QA autorisés, puis les
   audits de sécurité. Valider le read-back officiel et les acquisitions intactes.
6. Publier le client validé et relever son SHA/version réellement servis.
   Tester PWA Android/iOS, offline/reconnexion et deux appareils avant clôture.

Sans capability positive, le client conserve les huit faits historiques et
ne prétend pas confirmer un nouveau record officiel. Il ne transforme pas
une panne de classement en blocage de victoire. Le déploiement serveur reste
nécessaire pour conserver les nouvelles preuves officielles privées : ne pas
déclarer l’activation complète sur la seule base d’un client publié.

## Retour et restauration

Faire d’abord retourner 0 à la capability (désactivation explicite, qui invalide
le cache positif lors de sa prochaine lecture) et restaurer le client précédent si
nécessaire. **Ne pas restaurer aveuglément les profils d’avant déploiement** :
cela effacerait des acquisitions légitimes intervenues depuis. Conserver tous
les champs officiels, compteurs, reçus et archives déjà produits. Le retour sûr
garde la compréhension des faits facultatifs timing dans les fonctions serveur ;
une fonction ancienne qui les refuse bloquerait les intentions hors ligne.

Les nouvelles fonctions sont additives : un retour du seul client reste
compatible. Pour une correction serveur, partir des définitions sauvegardées,
garder le support des reçus à neuf faits et tester en restauration isolée les
reçus anciens et nouveaux avant remplacement. Ne retirer aucune preuve existante.
Les snapshots et reçus officiels restent dans les domaines déjà couverts par
l’export et l’effacement de compte ; aucun nouveau magasin de données personnelles.

## Acceptation

Cas de référence : 60 secondes réelles + cinq indices = 135 secondes, soit
2:15. Ancien officiel 110 : aucun record ; 150 : nouveau 135 ; 135 : égalité.
La fermeture avant le classement conserve les données. Rapidité reste évaluée
sur moins de 60 secondes réelles ; ses règles et les bonus ne sont pas migrés.
Le protocole social ancien, non versionné, reste en durée réelle et ne reçoit
pas de comparaison entre références anciennes et scores nouveaux incompatibles.

Les preuves automatisées locales et CI doivent être consignées dans la PR.
Les contrôles physiques et la migration de production restent des faits séparés.
