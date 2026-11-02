# TWA / mode avion — première investigation

## Constat vérifié dans le dépôt

Le service worker `sw.js` utilise une stratégie **network-first** pour les modules `/src/` et les contenus `/content/`. Son installation ne précharge que la page d'accueil, le manifeste et deux icônes. `index.html` charge `src/main.js`, Supabase et QRCode, qui **ne figurent pas** dans le shell initial. Ces ressources ne deviennent disponibles hors connexion qu'après une requête réussie pendant que le service worker contrôle la page. Les imports dynamiques, les données de grilles et les règles de verrouillage n'ont pas été audités exhaustivement ici.

**Conséquence :** un écran d'accueil visible en mode avion ne prouve pas que les grilles soient disponibles. L'absence de préchargement est un facteur de risque plausible, **pas un diagnostic définitif** de l'incident déjà signalé.

## Garde-fous

Ne pas ajouter aveuglément tout `/src/` ou `/content/` à `SHELL` : cela peut provoquer une installation incomplète, des versions mélangées, des coûts réseau importants ou des erreurs de disponibilité. Ne jamais mettre en cache les réponses Supabase, les URL OAuth, les tokens ou les données privées dans le cache public du service worker. Ne pas modifier les règles de progression ni la synchronisation pour masquer un échec de chargement.

## Tests à réaliser sur appareil (PWA puis TWA)

1. Installer Lumen avec connexion, lancer une quête, revenir au ciel, fermer puis rouvrir en mode avion : constater si une quête déjà jouée s'ouvre.
2. Après installation avec connexion, ouvrir une **autre** constellation non encore visitée, puis refaire l'essai en mode avion : distinguer cache d'assets, cache de données et verrouillage métier.
3. Avec connexion, recharger l'application pour laisser le nouveau service worker prendre le contrôle, puis tester le mode avion. Noter la version et le SHA affichés.
4. Répéter avec compte authentifié et profil invité ; ne pas créer de conflit cloud ni effacer IndexedDB pour tester.
5. Revenir en ligne, vérifier l'absence de perte de progression, de duplication de récompenses et de blocage de réconciliation.
6. Tester le lien de défi, la connexion Google et le bouton Retour Android ; ces cas ne sont pas couverts par le préflight statique.

## Étape de correction

Instrumenter de manière non sensible le chargement des modules et des grilles pour distinguer : ressource réseau manquante, cache absent, données locales absentes, garde d'authentification et blocage de progression. Puis seulement, prévoir un préchargement **versionné et borné** des ressources publiques réellement nécessaires, avec tests de mise à jour et rollback. Préserver les reçus et commandes hors ligne existants.

Le script `scripts/android-offline-preflight.mjs` vérifie les invariants PWA et signale le risque de shell minimal. Il **ne certifie pas** le jeu hors connexion et n'effectue aucune requête réseau ni écriture cloud.
