# Archive technique de Recette v2 — 22 octobre 2026

Mode opératoire et sources de vérité :
[aperçu isolé de recette](../../ISOLATED_VALIDATION_PREVIEW.md).

Ces fichiers sont des copies historiques de référence, volontairement conservées
en `.txt` : ils ne sont pas chargés par l'application et ne constituent pas une
nouvelle commande exécutable ou une deuxième fixture active.
Les fins de lignes sont normalisées en LF et les espaces de fin supprimés pour
respecter les contrôles du dépôt. `evidence.json` distingue les empreintes des
sources originales de celles des fichiers archivés ; aucune logique n'est changée.

| Fichier | Origine / rôle |
|---|---|
| `validation-fixture.js.txt` | Fixture du commit Sites `3e07114cb951657e3449381594e9a17168a1bebe`, avec normalisation textuelle décrite ci-dessus |
| `verify-isolation.mjs.txt` | Vérificateur d'isolation de ce même dépôt Sites |
| `prepare-free-validation.mjs.txt` | Script utilisé pour préparer le paquet ; hypothèses de répertoires et SDK initial présentes, non idempotent |
| `verify-free-validation.mjs.txt` | Pilote local navigateur/CDP, après ajout de la nouvelle victoire hors ligne et du cas d'indicateur trompeur ; chemins/ports/navigateur à adapter |
| `evidence.json` | Résultats synthétiques et retours manuels effectivement obtenus, sans données joueur |

Le pilote historique attend une arborescence temporaire avec les checkouts Lumen
et Sites côte à côte ; le lancer directement depuis ce dossier n'est pas supporté.
La source active et maintenable de l'aperçu reste le dépôt Sites. Une évolution
doit produire de nouvelles preuves datées plutôt qu'écraser cette archive.
