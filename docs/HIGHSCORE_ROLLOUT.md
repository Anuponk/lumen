# Highscore : activation et reprise contrôlée

La migration `20261111060216_highscore_victory.sql` prépare le podium, les pseudos
uniques et la participation automatique. Son installation ne lance aucune reprise
et laisse `automatic_after = NULL`, `historical_enabled = false`. Une livraison
client n'autorise pas à modifier la base de production partagée avec SoldeZen.

## Identités et confidentialité

`lumen.profiles` reste la source canonique : UUID privé, pseudo affiché après trim,
3–20 caractères, comparaison `lower(btrim(nickname))`, index unique et trigger
transactionnel. Les collisions historiques gardent leur orthographe ; tous leurs
propriétaires ont `nickname_ready=false` jusqu'au choix d'un nom disponible.
Le compte indique ce besoin à la connexion, sans bloquer progression/restauration.
Un message non bloquant invite alors à choisir ce pseudo dans Compte.
Un changement de pseudo n'affecte aucune clé de score ou de sauvegarde.

L'opposition `ranking_opted_out` appartient au profil serveur. Reconnexion,
synchronisation, renommage et import ne la retirent jamais. L'ancienne API
effaçait l'adhésion : un ancien run sans adhésion est traité conservativement
comme une opposition, y compris en l'absence d'un profil. Seule l'action explicite
« Rejoindre le classement » dans Compte peut la lever. Le retrait efface les scores
publics et conserve le cooldown. Les barrières d'effacement existantes couvrent
le profil et la sauvegarde privée de reprise ; aucune restauration aveugle.

Le RPC public ne publie que pseudo, rang et temps, avec indicateurs de virtualité,
de position et de ligne personnelle. Aucun UUID/email/clé technique. Les Échos
restent distincts et disparaissent à dix participants réels ; les totaux comptent
uniquement les personnes. L'ordre serveur et les ex æquo sont conservés sur tous
les scores, quelle que soit la taille du podium.

## Base légale : décision préalable à documenter

L'intérêt légitime est la base envisagée (article 6.1.f), pas une conformité déjà
acquise. L'éditeur doit consigner : finalité de compétition pseudonymisée,
nécessité de comparer les temps, test de mise en balance (attentes raisonnables,
public familial/enfants, visibilité entre connectés et effets du classement),
garanties/minimisation et droit d'opposition simple sans effet sur le jeu.
Références : [méthode CNIL](https://www.cnil.fr/fr/les-bases-legales/interet-legitime)
et [droit d'opposition](https://www.cnil.fr/fr/comprendre-mes-droits/le-droit-dopposition-refuser-lutilisation-de-vos-donnees).
Si la mise en balance échoue, ne pas activer cette base. Faire valider l'information
et sa diffusion aux joueurs existants avant l'activation ; la publication de la
page candidate seule ne prouve ni sa validation ni sa réception. L'analyse de
compatibilité d'une publication rétrospective est une décision distincte.

## Avant toute écriture en production

1. Vérifier les migrations antérieures et les checks SQL/RLS/concurrence sur base
   isolée. Auditer les collisions et les champs réels des profils sans exporter
   de données personnelles dans les logs. Relever les agrégats et le SHA livré.
2. Faire valider la mise en balance, l'information des joueurs, le droit
   d'opposition et, séparément, la finalité de reprise historique.
3. Réaliser une sauvegarde chiffrée contrôlée (scores, profils, adhésions, règles,
   barrières d'effacement). Vérifier sa restauration dans une base isolée avec
   les barrières actuelles. Protéger sa rétention et les droits d'accès.
4. Faire autoriser l'installation serveur coordonnée avec le client et la date
   d'information ; vérifier Compte, renommage/retrait, deux comptes isolés, puis
   position/temps public sans identifiants. `automatic_after` ne doit être fixé
   qu'à la frontière d'information validée ; les départs antérieurs restent exclus.
5. Lancer le rapport sans écriture :
   `select lumen_commands.import_ranking_history(false);`
   Conserver seulement les agrégats dans le bilan de recette.
6. Après autorisation distincte de la reprise, activer `historical_enabled` dans
   une transaction opérateur et appeler `import_ranking_history(true, <batch uuid>)`.
   Archiver le rapport retourné et l'identifiant privé du batch. Désactiver la
   reprise après l'opération. Ne jamais exposer ces fonctions aux clients.

## Sources et limites du rapport

Les performances de `profile_snapshots` et de `legacy_authority` sont rapprochées
par identifiant canonique ou correspondance legacy du registre serveur. Les temps
les plus bas sont regroupés par joueur/grille/révision. La table historique de
badges ne contient aucun chrono et est comptabilisée comme exclusion sans temps.
Les sauvegardes locales doivent d'abord suivre la synchronisation existante ;
aucun nouveau writer de progression n'est introduit. Les archives de récupération
ne sont pas republiées automatiquement : elles peuvent précéder un retrait,
un effacement ou une révision et nécessitent une provenance vérifiée séparément.

Les records originaux d'une grille toujours en révision 0 sont admissibles.
`state.gridRevision` ne certifie pas la révision de son minimum toutes versions :
les grilles révisées et les références inconnues sont exclues du classement,
mais leurs records personnels restent intacts. Aucun temps n'est déduit d'un badge.
La pénalité historique vaut zéro par convention produit, sans preuve d'absence
d'assistance. Un meilleur score compétitif est conservé. Les répétitions ne
créent aucun doublon ni récompense. Les nouveaux runs gardent +5 s Vérifier,
+15 s Indice, +5 s intervention guidée et les quinze minutes serveur.

Le rapport donne joueurs, records sources identifiés, exclusions et motifs,
identités admissibles dédupliquées, imports/améliorations et scores inchangés.
En dry-run, imports/améliorations sont prévisionnels. Un compte retiré/supprimé
est revérifié sous verrou au moment d'écrire.

## Retour arrière

Fermer `automatic_after` et `historical_enabled`, désactiver le client si besoin.
La fermeture du premier ne retire pas les adhésions déjà créées : pour arrêter
toute nouvelle publication, révoquer également les grants des RPC de compétition
selon la procédure de retrait serveur existante. Préserver les barrières RGPD.
`select lumen_commands.rollback_ranking_history(<batch uuid>);` restaure uniquement
le score précédent si le score courant est encore exactement celui importé ;
un score ultérieur, un retrait ou un effacement restent prioritaires. Aucun profil,
badge, solde, droit ou progression n'est restauré. Examiner les entrées ignorées
avant toute reprise manuelle. L'inventaire RGPD efface les sauvegardes de batch
avec les données Lumen ; elles ne doivent jamais servir à ressusciter un compte.

## Recette finale

Les issues #638/#647 restent ouvertes. Vérifier sur téléphone physique : victoire
complète puis tap sur son fond et sur une commande (premier tap consommé), second
tap de navigation, badges encore visibles, réduction des mouvements, clavier
virtuel dans Compte, safe areas, mode paysage, hors-ligne/reconnexion et deux
comptes concurrents. Consigner version, SHA public, appareil et résultats.
