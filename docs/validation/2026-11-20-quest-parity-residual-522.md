# #522 — Audit résiduel et matrice de parité des quêtes (20/11/2026)

Base : `main` `528d1974`. Lecture seule du code métier : **aucune refonte**. Seul ajout, le test exécutable
`scripts/quest-parity-matrix-tests.mjs`. Il suit l'audit du 22/10
([2026-10-22-quest-parity-audit.md](2026-10-22-quest-parity-audit.md)) et les PR #525/#527.

Catalogue au 20/11 : **880 quêtes**, dont 296 historiques (`legacyIndex` ≠ null) et 584 canoniques. Toutes
portent un attribut `rewards` explicite.

## Matrice automatisée (7 tests, verts)

| Comparaison | Historique (`base-q0xx`) | Récente (dernière canonique) | Artificielle (fixture ajoutée) | Verdict |
| --- | --- | --- | --- | --- |
| Étoiles, défi bonus, XP de première victoire | = `rewards` | = `rewards` | = `rewards` | **Parité** sur les 880 quêtes : le moteur historique (`applyLegacyVictory`, recalcul par index) produit exactement les données publiées |
| Badges (sans aide, aide, erreur, lent, non qualifiant) | identiques | identiques | identiques | **Parité** |
| Fragments, activité du jour | identiques | identiques | identiques | **Parité** |
| Rejeu : pas de seconde récompense | ✓ | ✓ | ✓ | **Parité** |
| Règles pédagogiques | ordinal | ordinal | ordinal | **Parité** (`questLearningRules`) |
| Accès : prérequis → séquentiel → rejeu, compte requis | — | ✓ | ✓ sans changement moteur | **Parité** (`catalogueQuestDecision`) |
| Clés de stockage | `solved[i]`, `noHint[i]`, `skyScore` | `canonicalQuestState[id]` | `canonicalQuestState[id]` | **Adaptateur de compatibilité** |

## Classement des différences restantes

| # | Différence (code) | Catégorie | Commentaire |
| --- | --- | --- | --- |
| 1 | Double schéma de sauvegarde `solved[legacyIndex]` / `canonicalQuestState[id]` (`persistence/canonical-progress.js`) | 1. Compatibilité indispensable | Sauvegardes, reçus V1/V2 et lignes serveur existants. Ne pas supprimer sans migration prouvée. |
| 2 | `skyScore` et `noHint[i]` écrits seulement pour l'historique (`campaign/legacy-victory.js`) | 1. Compatibilité | Score du ciel historique et import `lumen_save_progress` (`p_hints_used`). Aucun effet sur badges, XP ou accès. |
| 3 | Deux pipelines de commande et d'outbox (`captureLegacyCommandVictory` / `commitCanonicalVictory`) | 1. Compatibilité (transport) | Adaptateurs de stockage et serveur distincts. Les règles sont communes (voir la matrice). |
| 4 | Présentation de la victoire : `celebrateSuccess` enchaîne, pour l'historique, toast de récompense, proposition de compte au jalon, point d'étape de constellation et `markTutorialCompleted`. `celebrateCanonicalSuccess` suit sa propre séquence (`reveal`, `grantDaily`). | 3. **Divergence potentielle à prouver** | Parité utilisateur non démontrée. Un test navigateur comparatif est nécessaire avant de conclure. |
| 5 | Navigation : environ 25 branchements `legacyIndex===null` dans `ui/game-screen.js` (`advanceToNextPuzzle`, `handleSuccessAdvance`, `startCelestialQuest`, `openQuestReview`, `resumeHydratedCampaignSelection`…) choisissent `startCanonicalQuest` ou `levelIndex/startReplay`. | 3. Divergence d'architecture | Le résultat métier est le même (même décision d'accès). Le routage reste dupliqué. |
| 6 | Contexte d'accès : `questIsAccessible` utilise `campaignAccessAttempt()` (tentative stockée relue), `canonicalQuestAccess` utilise `attemptEngine.snapshot()` | 3. **Divergence potentielle à vérifier** | Une tentative canonique interrompue est-elle préservée au même moment du démarrage ? À couvrir par un test de reprise. |
| 7 | `rewardedBeforeReset` (réinitialisation de quête, #650) lu seulement par le chemin canonique (`quest-victory.js`) | 1 ou 3, à confirmer | La réinitialisation serveur vise la zone canonique. Si une révision de grille historique doit un jour être réinitialisée, le moteur historique devra appliquer la même garde. |
| 8 | Analytics et retours : `legacyIndex+1` comme identifiant de puzzle, `null` pour le canonique | 2. Exception de reporting | Compatibilité des tableaux existants. Ajouter l'identifiant stable sans retirer l'ancien. |
| 9 | Badges « Mon ciel » : `performanceBadges(i)` / `canonicalPerformanceBadges(id)` | Convergé | Les deux délèguent à `questPerformanceBadges(quest)`. Seule la recherche d'identité diffère. |

## Proposition de simplification (à valider avant tout code métier)

1. **Routage unique par quête** : introduire `startQuest(quest,{mode})` et `questAvailable(quest)`, qui décident à partir de l'objet quête. Le choix entre `levelIndex` et `canonicalActiveQuest` est confiné à un seul adaptateur. Remplace les branchements du point 5, sans changer stockage ni récompenses.
2. **Présentateur de victoire commun** : une séquence unique (verdict, badges, récompense, jalons, compte, constellation), alimentée par un résultat normalisé `{quest, outcome, confirmed}`. Les deux commandes restent des adaptateurs (point 3). Pré-requis : test navigateur comparatif du point 4.
3. **Garde de réinitialisation commune** (point 7), si le produit confirme qu'elle peut s'appliquer aux grilles historiques.
4. **Conservés tels quels** : schéma double, `skyScore`, `noHint`, reçus V1/V2 (points 1 à 3) jusqu'à une migration prouvée sans perte.

Découpage proposé : une PR par point 1, 2 et 3, chacune avec ses tests de non-régression et la CI complète. Aucune
modification des récompenses acquises, ni migration de profils.

## Limites

- Les projections pures sont testées. La parité de présentation (point 4) et la reprise (point 6) sont **non testées** à ce stade.
- Aucune donnée de production, aucun appareil réel.
