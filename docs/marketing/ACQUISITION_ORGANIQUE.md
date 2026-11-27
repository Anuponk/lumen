# Acquisition organique : vrai défi quotidien (#1056, #1057, #1064)

Le contrat actuel est décrit dans [Événements saisonniers natifs](EVENEMENTS_SAISONNIERS.md). Il remplace l'alternance de mini-puzzles : toutes les publications quotidiennes mènent au vrai défi, en entraînement non classé pour les invités. L'Avent est un habillage natif pour tous les joueurs, indépendant des réseaux sociaux.

La configuration appartient à LUMEN, sans requête Supabase supplémentaire. Les anciennes URL restent compatibles, avec une date passée ou future explicitement annoncée. Le publieur Meta direct reste désactivé. Aucun import ni programmation Metricool n'est exécuté par les générateurs. Le compte payant de Rachel est le canal retenu, sans API payante ni nouvel abonnement.

Les exports régénérés sont dans `docs/marketing/exports/` : `lumen-metricool-test-brouillon.csv` (un brouillon), `lumen-metricool-decembre-2026.csv` (31 posts) et `lumen-metricool-janvier-2027.csv` (31 posts). Vérifier les visuels et leurs URL publiques après livraison avant tout import. Préserver les 15 posts éditoriaux de 18h30 et ceux déjà programmés ; ne jamais importer deux fois le même lot.

## Import Metricool (canal retenu)

Le modèle du calendrier Metricool (Planificateur → ⋮ → Importer CSV → Télécharger le modèle), téléchargé le 27/11/2026, compte 102 colonnes. `METRICOOL_COLUMNS` (`src/acquisition/social-posts.js`) les reprend telles quelles, et la CI vérifie l'en-tête comme chaque ligne. Chaque ligne est un post photo **Facebook uniquement**, avec :
- le texte et son lien UTM complet ;
- la date et l'heure 08:00:00 ;
- le visuel du jour (`Picture Url 1`, URL publique sur `lumen.nopuna.fr`) et son texte alternatif ;
- le raccourcisseur de liens désactivé, pour garder les UTM.

Le fichier est en UTF-8 avec BOM, comme le modèle.

1. **Répétition** : générer un post en brouillon et l'importer.
   ```
   node scripts/marketing/social-posts.mjs --metricool=test.csv --from=2026-12-01 --to=2026-12-01 --draft
   ```
   À l'import, choisir le format de date `AAAA-MM-JJ` et l'heure `HH:MM:SS`. Vérifier dans le brouillon les retours à la ligne, le lien, l'image et l'heure. Le fuseau de la marque doit être Europe/Paris. Supprimer ensuite le brouillon.
2. **Mois complet** :
   ```
   node scripts/marketing/social-posts.mjs --metricool=decembre.csv --from=2026-12-01 --to=2026-12-31
   ```
   Importer le fichier **une seule fois**. Un second import créerait des doublons, que Metricool ne détecte pas.
3. **Contrôle** : 31 posts doivent apparaître à 08h00 dans le calendrier, sans conflit avec les 15 posts éditoriaux de 18h30, ni avec les posts déjà programmés sur l'ancien compte gratuit.
4. **Arrêt** : supprimer ou repasser en brouillon les posts programmés dans Metricool.

Prévoir l'import de janvier avant le 31 décembre, en régénérant d'abord calendrier et visuels si besoin.

## Recette à faire

| Parcours | Preuve attendue | État |
|---|---|---|
| Android installé, PWA iPhone, navigateur intégré Facebook | Lien réel, invité et compte, affichage compact FR/EN/ES | Recette physique à faire |
| Aperçu Facebook | Bon titre et vraie grille initiale après livraison des URL | À vérifier avant diffusion |
| Import Metricool | Un brouillon, retours à la ligne, image, 08:00 Paris, aucun doublon | Validation propriétaire avant import |
| Notifications | Consentement puis réception réelle, titre saisonnier | Déploiement Edge et recette appareil distincts |
