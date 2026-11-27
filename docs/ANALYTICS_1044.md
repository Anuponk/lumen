# Analytics #1044 — activité, temps de jeu, limites Gratuit/Premium et conversion

Statut : livré le 28/11/2026 dans le cockpit existant (#708), section **Analytics › Activité & Premium**
(`/admin/analytics?section=activity`). Aucune modification de prix, de quota, de droit Premium ni de
réglage commercial. Coordination : #708 (cockpit), #1030 (règles Premium et quotas), #1029 (boutique),
#1036 (rétention liée aux notifications, non dupliquée ici).

## 1. Audit des sources (28/11/2026)

| Source | Ce qu'elle prouve | Couverture | Utilisée pour |
|---|---|---|---|
| `lumen_commands.ranking_runs` | Une ligne par tentative d'un **compte connecté**, au premier geste, horloge serveur. Une réinitialisation ciblée ré-émet la tentative sous `<id>-reset-N` ; une reprise réutilise la ligne. | depuis le 11/11/2026 | tentatives, joueurs actifs, nouvelles/rejeux |
| `canonical_receipts` / `legacy_receipts` | Victoire enregistrée par le serveur (clé `(user_id, operation_id)` : doublons et synchronisations tardives fusionnés). `facts.seconds` = chronomètre effectif (pauses et arrière-plan exclus) **sans** pénalités ; `outcome.firstCompletion`. | 100 % des tentatives terminées depuis le 11/11 | quêtes terminées, temps de jeu, première victoire |
| `quest_run_authority` | Quête déjà résolue avant tout reçu (historique, import) | complète | classement nouvelle/rejeu sans reçu de première victoire |
| `quota_attempts`, `quota_state`, `commerce_settings(_audit)` | Compteurs serveur du quota (#1030), activation au seuil, historique effectif des réglages | depuis l'activation du 27/11/2026 14:28 UTC ; conservation 45 jours | quota atteint, joueurs soumis au quota, limites en vigueur par jour |
| `purchases` (+ `store_products.kind='premium'`) | Registre serveur des achats confirmés (Stripe webhook, Play vérifié), unique par référence prestataire | complète | achats Premium (source de vérité), attribution |
| `stripe_checkout_sessions` | Checkouts web créés / terminés / **expirés** (abandon identifiable) | complète | abandon Stripe |
| `premium_grants` + achats | Droit Premium daté (`premium_since`) | complète | segment Gratuit/Premium au jour |
| `lumen.analytics_events` | Collecte produit publique **désactivée** (vide depuis le 26/10) | — | non utilisée |
| **Nouveau** `commerce_events` | Boutique et message de limite (voir §2) | à partir du déploiement de cette PR | ouvertures, clics, paiements initiés/annulés/échoués, blocages, messages |

Rien n'enregistrait avant ce chantier : l'ouverture de la boutique, le clic « Passer à Premium », l'ouverture
de la feuille Google Play, son annulation/erreur, la tentative refusée par le quota ni l'affichage du message.
**Aucun historique n'est reconstitué** : ces indicateurs commencent au déploiement (« non mesuré » avant).

## 2. Instrumentation ajoutée (sobre)

Table `lumen_commands.commerce_events` (RLS, aucun accès client direct), écrite uniquement par
`public.lumen_track_commerce(p_events jsonb)` :

| Événement | Quand | Champs |
|---|---|---|
| `shop_open` | affichage **volontaire** de la boutique (une fois par affichage ; les rendus/rafraîchissements de l'offre ouverte ne repassent pas par là) | origine, canal, visite, produit, prix et devise proposés |
| `shop_close` | fermeture de la boutique | visite, durée d'affichage |
| `cta_click` | appui sur « Passer à Premium » (ou achat unitaire si l'offre historique est affichée) | visite, produit |
| `checkout_start` | juste avant la redirection Stripe / l'ouverture de la feuille Google Play | canal, produit |
| `checkout_cancel` | retour Stripe « annulé » / feuille Play fermée par le joueur | canal |
| `checkout_error` | checkout Stripe non créé / erreur de la feuille Play | canal |
| `limit_block` | premier geste refusé au-delà d'une limite (#1030) | `new` ou `replay` |
| `limit_shown` | message de limite effectivement ouvert | `new` ou `replay` |

Origines : `locked_adventure` (aventure verrouillée touchée dans le ciel ou quête suivante verrouillée),
`quota_new`, `quota_replay` (bouton « Découvrir Premium » du message), `premium_feature` (statistiques Premium),
`voluntary` (réservée : il n'existe pas encore d'entrée « Boutique » dédiée), `other`.

Garanties : identifiant d'événement client (déduplication des retries), lots ≤ 20, file locale bornée à
60 événements par compte (hors ligne), envoi à la fermeture de la boutique, au passage en arrière-plan ou
après 2,5 s, **aucun polling**, aucun événement de grille ; serveur : horodatage accepté entre −7 jours et
+10 min, plafond 300 lignes/compte/24 h, événement invalide ignoré sans bloquer le jeu, purge à 90 jours à
chaque écriture, effacement avec le compte (`lumen_privacy.policy()`). Comptes connectés seulement (les
invités ne peuvent pas acheter et ne sont pas mesurés). Aucune donnée de paiement.
Base légale : intérêt légitime, mesure agrégée, documentée dans la politique de confidentialité (version
du 28/11/2026, FR/EN/ES). **À valider par le propriétaire.**

## 3. Lectures du cockpit

Trois RPC lues **ensemble**, seulement quand la section est affichée ou qu'un filtre change (mise en cache par
jeu de filtres jusqu'à « Actualiser ») ; toutes exigent `analytics_cockpit`, refusent `anon`, ne renvoient
que des agrégats :

- `public.lumen_admin_activity(p_days, p_include_internal, p_segment)` — séries quotidiennes, comportement, quotas atteints ;
- `public.lumen_admin_conversion(p_days, p_include_internal, p_channel, p_window_days)` — limites bloquantes/messages, boutique, funnels, attribution, fidélisation ;
- `public.lumen_admin_quota_simulation` (#1030, réutilisée) — quotas 5/10/15/20/25/30/50.

Filtres : 7/30/90 jours (30 par défaut), comptes internes exclus par défaut (`lumen.internal_capabilities`,
toute capacité), Gratuit/Premium/Tous, Web/PWA/Google Play/Tous, attribution même journée ou 7 jours.
Fuseau Europe/Paris ; la journée en cours est hachurée et marquée « incomplète ».

## 4. Définitions

**Activité** — *tentative* = identifiant de base d'une `ranking_run` (une réinitialisation ou une reprise ne
crée pas de tentative) ; *joueur actif* = au moins une tentative dans la journée ; *terminée* = reçu de victoire ;
*nouvelle quête* = tentative commencée avant la première victoire de la quête, *rejeu* = après (#1030) ;
*jour* = date Europe/Paris du premier geste (une partie à cheval sur minuit compte le jour de son début).
Moyennes par joueur actif = total / joueurs actifs du jour. Avant le 11/11/2026 : non mesuré (jamais 0).

**Temps de jeu** — somme de `facts.seconds` du run gagnant (une réinitialisation remet le chronomètre à zéro :
le temps antérieur n'est pas compté) ; durées hors 1 s–6 h exclues. Les tentatives abandonnées n'ont pas de
durée fiable : le périmètre affiché est « quêtes terminées », avec le taux de couverture (durées valides /
quêtes terminées). Moyenne = minutes / joueurs ayant au moins une durée valide ce jour-là
(exemple vérifié : 10 + 20 + 30 min = 60 min, 20 min par joueur).

**Comportement** — par journée-joueur active (journées sans activité exclues) : moyenne, médiane, P75/P90/P95
des tentatives (`percentile_disc`), moyennes de nouvelles quêtes et de rejeux, distribution des nouvelles
quêtes 1–5, 6–10, 11–15, 16–20, 21–30, > 30 (les journées de rejeux seuls sont signalées à part).

**Gratuit / Premium** — Premium à un instant = droit dérivé comme `premium_status` (achat Premium, ciel complet,
upgrade, 5 aventures, octroi actif), daté par achat/octroi ; une tentative est Premium si le droit précède son
début. Quotas et fidélisation : statut au **début** de la journée (un gratuit qui achète dans la journée reste
compté gratuit ce jour-là). Remboursements et révocations s'appliquent rétroactivement.

**Limites** — trois situations distinctes :
1. *quota atteint* : le compteur serveur du jour (`quota_attempts`) a atteint la limite **en vigueur ce jour-là**
   (historique `commerce_settings_audit`, jamais de valeur codée en dur) — un joueur qui termine sa 15ᵉ quête
   sans en commencer d'autre est « atteint », pas « bloqué » ;
2. *tentative bloquée* : premier geste refusé (chaque nouvel essai compte ; joueurs et journées-joueurs distincts affichés) ;
3. *message affiché* : boîte de dialogue de limite ouverte.
Dénominateur des proportions : journées de joueurs gratuits actifs ayant franchi le seuil, depuis l'activation des quotas.

**Simulation** — `lumen_admin_quota_simulation` sur la période (gratuits après le seuil, comptes internes toujours
exclus). Les journées antérieures à l'activation (27/11/2026 14:28 UTC) mesurent la demande libre ; après, la
demande au-delà de la limite est **censurée** (tentatives refusées) et la simulation la sous-estime. Les
observations sous quota (situations 1–3) sont affichées séparément. Réévaluation prévue le 25/12/2026.

**Boutique** — ouvertures (événements) ≠ visiteurs (joueurs distincts) ; ouvertures par visiteur ;
conversion boutique = acheteurs Premium / visiteurs. *Achat confirmé* = registre `purchases` (paid ou remboursé
ensuite), dédupliqué par le prestataire ; un clic ou un retour de checkout n'est jamais une preuve. Paiement
abandonné : identifiable seulement pour Stripe (session expirée) ; côté Play, une feuille fermée = annulé.

**Funnels** (joueurs distincts, ordre chronologique : chaque étape est le premier événement **après** l'étape
précédente, dans la fenêtre comptée depuis l'étape d'entrée) :
- *après blocage* : gratuits actifs → premier blocage → boutique ouverte après → clic → paiement initié → achat ;
- *boutique* : première consultation (toute origine) → clic → paiement initié → achat ; les achats sans
  visite mesurée sont comptés à part (achat avant la mesure, autre appareil).
Pour chaque étape : effectif, % de l'étape 1, taux de passage, taux d'abandon.

**Attribution** — un achat est attribué à l'origine de la **dernière** ouverture de boutique qui le précède
dans la fenêtre (même journée ou 7 jours), par canal de paiement ; sinon « sans visite mesurée ».

**Fidélisation après une limite** — unité : journée d'un joueur gratuit actif ayant franchi le seuil
(journée en cours exclue). Exposée = au moins un blocage ce jour-là ; référence = mêmes conditions sans blocage.
J+1 / J+7 = activité le jour exact (J+7 seulement si le recul est complet) ; quêtes et minutes des 7 jours
suivants ; achat Premium sous 7 jours ; ancienneté, progression (quêtes résolues) et activité des 7 jours
précédents affichées pour juger la comparabilité. **Corrélation, pas causalité.**

## 5. Limites de couverture

- Invités non observables (aucune tentative serveur) ; défis du jour et duels hors périmètre (V1 campagne).
- Temps de jeu = quêtes terminées seulement ; pas de temps de session ni d'abandon.
- Boutique, blocages et messages : à partir du déploiement de cette PR ; avant, « non mesuré ».
- Un joueur dont l'application est fermée avant l'envoi garde ses événements localement (60 max) jusqu'à la
  prochaine ouverture connectée ; au-delà de 7 jours ils sont refusés.
- Les quotas observés dépendent de `quota_attempts` (conservation 45 jours) : la période 90 jours ne les couvre
  que depuis l'activation.
- Échantillon actuel très faible (quelques joueurs) : les taux sont affichés avec leurs effectifs.

## 6. Coût Supabase (mesuré le 28/11/2026)

Voir le commentaire de livraison de #1044 pour les mesures avant/après (temps d'exécution, volumes).
Écriture : au plus quelques lignes par visite de boutique ou par blocage (≈ 100 octets/ligne), un appel RPC par
lot ; lecture : 3 appels par ouverture de la section ou changement de filtre, réponses de quelques ko.
