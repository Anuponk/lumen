# Lumen Android / Google Play — audit initial et choix de conteneur

Statut : **audit préliminaire** (2 novembre 2026). Aucun packaging Android, aucun test sur appareil et aucune validation Google Play n'ont encore été réalisés. Référence : issue #170. Le chantier de suppression #316 est indépendant et reste bloquant pour la publication.

## Constats vérifiés sur main

- Application web statique avec `index.html`, styles et scripts sous `src/ui/` ; `package.json` est minimal (Node >=22, scripts de test), sans outil de build Android ni dépendance Capacitor.
- `manifest.webmanifest` : nom LUMEN, `start_url` et `scope` à `/`, `display: standalone`, `orientation: portrait-primary`, thème sombre, icônes SVG standard et maskable.
- `index.html` référence le manifeste, les styles et les scripts, et expose des parcours Google et email/mot de passe. Le comportement OAuth Android, les retours d'intent et les deep links ne sont **pas** validés par cette simple lecture.
- Les incidents de grilles inaccessibles hors ligne, de synchronisation et de reprise de progression déjà signalés nécessitent une recette Android indépendante. Aucun niveau de support hors ligne n'est présumé.

## Décision d'architecture provisoire

**Évaluer d'abord une Trusted Web Activity (TWA)**, car Lumen est déjà une PWA hébergée et la TWA peut conserver la même application web et le même backend sans réécrire la synchronisation. **Ne pas acter définitivement TWA avant les essais** : authentification Google, parcours de suppression, liens de défis, notifications, partage, comportement hors ligne et navigation Retour doivent être testés sur un appareil réel. Une TWA dépend du navigateur compatible et du site ; son emballage n'améliore pas à lui seul l'accès aux grilles hors connexion.

**Revenir à Capacitor** si les exigences produit imposent une intégration native plus poussée (ressources hors ligne embarquées, notifications natives, deep links ou intégration système) ou si les tests TWA échouent. Capacitor demandera un build d'actifs web reproductible et des adaptations ciblées ; ne pas l'introduire avant d'avoir identifié ces besoins.

## Préparation technique sans toucher au cœur du jeu

1. Définir l'identifiant Android stable, le nom commercial, le propriétaire du compte Play et la stratégie de signature ; ne pas inventer de package ID ou de clé.
2. Fournir des icônes PNG adaptatives et les visuels requis ; vérifier la lisibilité des SVG existants. Préparer un splash screen et les captures d'écran réelles.
3. Pour une TWA : confirmer l'origine HTTPS canonique, configurer Digital Asset Links sur le domaine, vérifier l'association de l'empreinte du certificat de signature **réel** et de l'identifiant Android choisi. Ne pas publier de `assetlinks.json` fictif.
4. Tester l'authentification Google et email/mot de passe, la redirection de retour, la création de compte, le rattachement de la progression anonyme et la reconnexion sur PWA et Android.
5. Tester en conditions réelles : réseau normal, réseau dégradé, mode avion, reprise après fermeture forcée, Retour Android, orientation, tailles d'écran, partage de défis, notifications, suppression de compte et absence de réapparition des données.
6. Préparer la fiche Play : classification d'âge, public cible et exigences Families si enfants visés, déclaration Data Safety fondée sur les flux réellement observés, URL de confidentialité, URL de demande de suppression, contact et captures.
7. Produire un AAB signé dans un environnement Android reproductible ; tests internes/fermés et exigences de publication Google Play en vigueur au moment de la soumission. La publication n'est pas automatique après la génération d'un AAB.

## Critères de sortie de la phase d'audit

- Choix TWA/Capacitor argumenté par tests, pas uniquement par préférence.
- Identifiant Android et chaîne de signature validés par l'éditeur.
- Checklist de tests reproductible et preuves des scénarios compte/synchronisation.
- Aucun changement de modèle de données ou de cloud persistence sans revue spécifique.
- #316 opérationnel, politique de confidentialité et Data Safety cohérentes avant demande de publication.

**Périmètre de cette PR : documentation seulement.** Pas de migration Supabase, pas de secrets, pas de génération d'AAB, pas de modification du site en production.
