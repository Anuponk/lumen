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
effaçait l'adhésion, même sans tentative : il est impossible de distinguer un ancien
retrait d'une absence d'inscription. Les comptes Lumen historiques sans adhésion
active sont donc protégés conservativement, y compris sans profil ni tentative.
Cette cohorte est figée une seule fois : rejouer la migration n'exclut pas les
nouveaux comptes. Les anciennes adhésions actives sont conservées ; les nouveaux
comptes restent éligibles à la participation automatique après activation.
Pour les comptes historiques indéterminés, seule l'action explicite
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

<a id="classements-constellation-et-aventure-974"></a>

## Classement général par aventure (#974)

Les arbitrages du propriétaire du **27/11/2026** remplacent le barème et le périmètre
validés le 24/11. Migration de mise à niveau :
`20261127051221_adventure_ranking_score_974.sql` après le socle
`20261126200100_constellation_rankings_974.sql`.

### Score 20/50/30

Chaque quête **officiellement classée** vaut au plus 100 points :

- 20 pour la complétion attestée par le record officiel éligible ;
- de 0 à 50 pour la performance, k=arrondi(50 × (N − rang)/(N − 1)) ;
  si N=1, k=50. N compte les joueurs éligibles distincts de cette quête ;
- 15 pour le badge durable Sans assistance (champ serveur autonomie / `autonomy`) ;
- 15 pour le badge durable Sans erreur (`noError`).

Les égalités gardent le rang officiel `rank()`, donc les mêmes points de
performance ; des badges différents peuvent donner des totaux différents.
Rapidité et Maîtrise n'ajoutent aucun bonus. Une quête sans record officiellement
classé vaut zéro, même si elle a des badges ou un essai abandonné/non qualifiant.
Exemples : premier avec les deux badges 100, premier sans badge 70, milieu d'une
population de 101 avec les deux badges 75, dernier avec les deux badges 50,
dernier sans badge 20. Pas de gain illimité par rejeu.

### Provenance des badges et resets

Les bonus utilisent les **badges acquis durablement reconnus par le serveur pour
la même quête**, indépendamment de la tentative du meilleur chrono et du dernier
essai. Le calcul ne fabrique ni qualification, ni badge, ni temps historique.

- Quêtes canoniques : `quest_run_authority.projection.badges`.
- Quêtes historiques à index numérique : `legacy_authority.projection.performances[index].badges`,
  source utilisée par les commandes de victoire historiques.
- Une projection ayant `reset_info` prend priorité sur l'ancienne projection
  historique, y compris quand ses badges sont vides. Une ancienne copie ne
  rétablit donc pas les bonus effacés par un reset.
- Un ancien chrono sans preuve de badge reçoit zéro bonus ; sa pénalité nulle
  n'est jamais interprétée comme une preuve de Sans assistance ou Sans erreur.
- Un nouveau badge durable peut améliorer les points après un essai plus lent,
  sans modifier le record officiel. Les rejouages identiques, Rapidité et Maîtrise
  seuls ne changent aucun point et n'entraînent pas de réécriture des agrégats.
- Le reset suit les projections existantes : effacement des badges = retrait
  des bonus. Un record ne cesse de fournir complétion/performance que lorsqu'il
  cesse d'être éligible selon les règles chronométriques existantes (révision de
  grille, retrait, etc.). Aucun record n'est supprimé par ce changement de barème.

### Agrégats et fraîcheur

`ranking_quest_points` matérialise place et points par quête/joueur, les totaux
aventure somment ces points. Les 880 regroupements restent ceux du catalogue ;
le maximum vient de `questTotal × 100` : 10 000 pour 100 quêtes, sans coder en dur
les tailles d'aventure. Les agrégats constellation et leur RPC historique restent
compatibles pour les anciens clients ; le nouveau client ne les consulte plus.

Un changement de N ou de rang peut changer tous les points de **cette quête**.
Les déclencheurs d'instruction coalescent les lignes d'un même changement par
quête ; une évolution de badge ne rafraîchit que les quêtes classées affectées.
Seuls les joueurs dont la place ou les points changent sont propagés aux totaux.
Une instruction sur les badges Rapidité/Maîtrise ne déclenche pas ce recalcul.
Les mises à jour source distinctes restent des événements distincts, sans job
ni polling ; aucun regroupement différé n'expose des totaux périmés à la lecture.

Les écritures des quêtes d'une même aventure sont sérialisées par verrou
transactionnel d'aventure, puis de quête ; les parcours multiples ordonnent
aventures et quêtes. Cela évite qu'un total perde une modification concurrente
provenant d'une autre quête. Les totaux sont ressommés, jamais décrémentés à partir
d'un cache client. Participation, pseudo prêt, retrait, révision courante et
effacement gardent la population éligible du classement chronométrique existant.

### Interface et lectures Free-first

Seul le **classement par aventure** est exposé, depuis Mon ciel et les résultats.
Le podium chronométrique et la position personnelle de fin de quête sont conservés,
sans accès à une liste complète par quête. Le Défi du jour garde ses classements,
son barème, ses récapitulatifs et ses récompenses.

- Ouverture : une RPC `lumen_group_ranking('adventure', id)`, podium 2 – 1 – 3 et ma
  position (maquette validée du 27/11, `lumen-marketing/maquettes/974-classement-aventure.png`).
- « Voir autour de ma position » : une RPC bornée à 11 lignes centrées sur le joueur
  (20e → rangs 15 à 25) ; sur le podium ou non classé : rangs 4 à 13. « Voir avant » /
  « Voir après » : blocs de 10 contigus, ancre de lecture conservée, boutons masqués aux
  bornes. Les lignes du podium ne sont jamais ajoutées à nouveau ; repli sans relecture.
- Une page ne relit ni ne renvoie le podium ou le résumé personnel déjà chargés.
  Repliage/réouverture des pages chargées : zéro RPC. Aucun polling ou Realtime.
- Le marqueur `scoringVersion=2` évite d'expliquer le nouveau barème sur un ancien
  backend. Les réponses initiales exposent aussi le maximum dérivé du catalogue.
- Les pseudos restent du texte, la surbrillance personnelle et les trois couleurs
  du podium sont conservées. FR/EN/ES et largeur mobile vérifiés en navigateur simulé.
- Recette propriétaire du 27/11 : sur le podium, ma ligne surlignée suffit (pas de
  bloc « Ta place »). Hors podium, ma position est une ligne de classement comme les
  autres (rang, pseudo, points, quêtes), après un séparateur discret, sans médaille ;
  elle est masquée quand la liste chargée la contient déjà et réapparaît au repli.
  Tant qu'il reste des joueurs, un bouton explicite « Voir plus (N restant(s)) » charge
  la page suivante ; les tests couvrent 6, 13 et 14 participants et le dernier lot.
- Correctif serveur (27/11) : une demande de page (`p_limit>0`) lisait un
  enregistrement personnel jamais affecté ; sur une connexion dont le plan PL/pgSQL
  n'avait pas encore vu l'ouverture, la RPC échouait (« record v_mine is not assigned
  yet ») et le dépliage restait sur « Réessayer ». Migration
  `20261127230000_ranking_page_fix_974` (variables scalaires, même résultat) et
  test `fixtures/ranking-page-fix-974.sql` exécuté dans une session neuve.

Coût du recalcul : O(N log N) pour les rangs de la quête modifiée, jointures indexées
sur les sources de badges et propagation aux seuls totaux modifiés. Pas de lecture
de profil complet, aucune ligne source modifiée, aucune nouvelle table ou tâche
planifiée. Une reconstruction globale **unique** intervient à la migration.
Mesure locale indicative sur PostgreSQL embarqué isolé : instruction de 1 000
scores, environ 0,17 s avec l'ancien barème et 0,14 s avec le nouveau. Cette mesure
de développement, sensible aux caches, n'est ni un gain garanti ni une latence
de production ; la CI journalise aussi le temps du scénario à 1 000 joueurs.
Prévisualisation production en lecture seule du 27/11 : 2 338 scores éligibles,
19 joueurs, 802 quêtes ; 1 508 points de quête changeraient, tous entre 20 et 100.

### Migration, validation et retour arrière

Appliquer la migration avant de publier le nouveau client, vérifier la parité des
points/totaux avec les sources et conserver les règles d'effacement/export du
socle #974 et de #1015. La migration recalcule les agrégats existants, sans toucher
aux chronos, badges, reçus, achats, monnaies ou sauvegardes. La rejouer est idempotent.
Le basculement attend les écritures source en cours puis les bloque brièvement
pendant la reconstruction, afin qu'un ancien calcul ne réécrive pas le vieux
barème après le commit. Les lectures restent possibles ; `lock_timeout=5s` fait
échouer et annuler la migration si elle ne peut pas obtenir ses verrous à temps.

En retour arrière, retirer les nouveaux déclencheurs de badges, restaurer les
anciennes définitions des fonctions de rafraîchissement et de lecture du socle,
puis reconstruire les seuls agrégats et revenir au client correspondant. Ne pas
rejouer une ancienne politique RGPD ni effacer des données source. La fonction
historique `ranking_points(integer)` reste disponible pour cette compatibilité ;
elle ne pilote plus les nouveaux agrégats.

Tests : `group-ranking-tests.mjs`, scénario navigateur `assistance-browser.mjs`,
fixtures `rankings-974-score-bootstrap.sql` et `rankings-974-score.sql`,
`rankings-score-concurrency.py`. Ils couvrent le passage réel de l'ancien au nouveau
barème, les historiques inconnus, les deux sources de badges, les resets,
les essais non classés, les égalités, N=1, grands effectifs, arrivées/retraits,
les écritures concurrentes sur deux quêtes et les reconstructions répétées.
Les suites chronométriques et le Défi du jour restent des non-régressions séparées.
La recette sur téléphone physique reste à faire après publication.

### Records historiques prouvés sur la grille actuelle (27/11/2026)

L’import du 11/11 excluait toute quête dont la grille n’est plus en révision 0. Les temps
qualifiés après une réinitialisation de quête vers la révision actuelle sont désormais
importés (migration `ranking_reset_proven_records_974`, 171 records mesurés sur les aventures
5 et 6), avec sauvegarde et mêmes garde-fous ; les cas non prouvés restent exclus.
