# #316 — Suppression autonome sécurisée (plan de livraison)

## État courant du 4 novembre 2026

Complément du 5 novembre : le handler UI exige aussi l'acquittement JSON exact
de l'Edge avant toute déconnexion/nettoyage. Une réponse 200 vide, en attente,
d'un autre périmètre ou illisible conserve les données locales. Le compte et la
génération sont revérifiés après les attentes ; une session remplacée ne reçoit
pas le résultat tardif. Le nettoyage requiert une déconnexion réussie et le même
propriétaire local. Régression exécutant le vrai handler :
`scripts/self-erasure-controls-tests.mjs` (transport et nettoyage fictifs).
Ce correctif client n'active pas l'effacement serveur.

Le contrat de livraison courant est celui de la PR #611 : Edge avec vérification
Auth du JWT, cible dérivée de cette identité, credentials service uniquement côté
serveur, wrapper SQL privilégié puis moteur transactionnel existant. Les sections
de conception ci-dessous décrivent l’ancienne proposition ; elles n’autorisent
pas un serveur/worker supplémentaire ni des identifiants PostgreSQL propriétaire.

Après autorisation explicite du propriétaire, la recette SQL a été exécutée dans
le projet partagé, **uniquement dans les espaces QA dédiés**. Le schéma vide
`lumen_erasure_qa` a été réutilisé ; les copies de données, commandes, API, Auth
fictive et autre application sont préfixées `lumen_erasure_qa_`. Aucun namespace
de production n’est ciblé par cette adaptation, ni aucun compte réel supprimé.

`node scripts/erasure-qa-schema.mjs` génère l’adaptation de namespace du moteur
complet et du wrapper, avec refus de namespace inconnu et contrôle d’absence de
référence qualifiée aux schémas de production. Source SHA256 de la recette :
`14e0229abbec9d22e8d18b64d7b40d9e347f72b580cfecb108b5b3af11cdb988`
(source normalisée LF ; code identique à la recette distante).
Les modes `--setup`, `--schema-check`, `--fixture` sont des outils QA à relire,
jamais des migrations de publication. Le setup refuse de remplacer des objets QA
existants ; les tests de lignes synthétiques se terminent par ROLLBACK.

Résultat sur PostgreSQL partagé : effacement du moteur complet, confirmation,
refus de schéma inconnu, barrière anti-résurrection et appel du wrapper sous le
rôle service passés. Auth et autre application **fictives** conservées. Après
rollback : profils, identités fictives et barrières QA vides ; pas d’USAGE du
schéma privé pour anon/authenticated/service_role. La RPC de production reste
absente. Les objets QA restent privés, sans activation du service d’effacement.

Cette preuve SQL ne valide pas encore la chaîne interface → JWT réel → Edge →
RPC. Une recette authentifiée isolée de cette chaîne et une décision séparée
d’activation production restent nécessaires ; #611 reste ouverte.

## Décision d'architecture

L'effacement SQL existant est **opérateur uniquement** : `lumen_privacy.erase_account(uuid,text[],text)` est accessible au propriétaire PostgreSQL, et `review_erasure` refuse explicitement une session `auth.uid()` non nulle. Le rôle `service_role` n'a pas accès au schéma. **Ne pas** accorder `EXECUTE` aux rôles client, ni exposer le propriétaire PostgreSQL dans le navigateur ou une Edge Function. Ne pas supprimer `auth.users` : l'identité est partagée avec SoldeZen.

La page publique actuelle ne fait que préparer un `mailto:`. La recette CI #604 couvre ce comportement, **pas** une suppression autonome.

## Contrat cible (non activé)

1. **Compte connecté** : écran « Supprimer mes données Lumen » dans le profil, avec conséquences et confirmation explicite. Exiger une réauthentification récente côté serveur, et vérifier le jeton auprès de Supabase Auth, ainsi que la validité de la session. Le serveur déduit l'UUID de l'identité vérifiée ; il n'accepte jamais un UUID cible fourni par le client.
2. **Identification du périmètre** : résoudre les identifiants invités/anonymous IDs uniquement à partir des associations vérifiées côté serveur. Refuser si ambigu, plutôt que supprimer des données d'un autre joueur.
3. **Traitement privilégié** : un worker opérateur privé et isolé, avec secret PostgreSQL propriétaire hors client, examine `review_erasure`, vérifie la politique des copies et la portée, puis exécute `erase_account` dans une transaction. Aucune exposition directe des fonctions privées via Data API ou rôle service.
4. **Idempotence et suivi** : requête avec identifiant opaque, état `pending/verified/processing/completed/failed`, anti-rejeu, limitation de fréquence et audit minimal. Ne jamais afficher « supprimé » si la transaction, les copies ou les contrôles post-effacement ont échoué.
5. **Sessions et hors-ligne** : bloquer les nouvelles écritures Lumen dès l'effacement (barrières SQL), invalider ou neutraliser les sessions applicatives, purger le cache local seulement après accusé de succès, et vérifier les anciens appareils ainsi que la restauration.
6. **Sans connexion** : conserver une voie publique accessible, avec vérification d'identité et traitement assisté ; ne jamais considérer la simple connaissance d'une adresse email comme une preuve.

## Conditions de sécurité bloquantes

- Confirmer l'hébergement du worker et sa gestion de secrets (pas de nouveau service payant implicite).
- Confirmer un mécanisme de réauthentification compatible Google et email/mot de passe, et sa vérification **serveur** ; les claims `user_metadata` ne servent pas d'autorisation.
- Prouver les liens entre acteurs anonymes et UUID avec des fixtures multi-appareils.
- Tester sur PostgreSQL jetable : demande valide, autre utilisateur, SoldeZen intact, double clic/rejeu, session périmée, panne transactionnelle, écritures offline tardives, restauration, défi social tiers.
- Recette navigateur sur compte fictif **isolé**, sans effacer de joueur réel ni tester en destruction sur le Supabase partagé.
- Audit juridique séparé : délais, prestataires, conservation, mineurs, Google Play.

## Lots de réalisation

**A — UX + protocole** : profil, confirmation, tests de parcours, aucun appel destructif.
**B — Backend privé** : authentification récente, file de demandes, worker et secrets, tests d'intégration isolés.
**C — Activation contrôlée** : recette de bout en bout sur environnement jetable, revue de sécurité, activation explicite ; conserver la voie manuelle comme secours.

## État

Spécification uniquement : **aucun endpoint d'effacement automatique déployé**, aucune migration supplémentaire appliquée, aucun compte supprimé. Les tests SQL et de formulaire déjà verts restent valables. Ne pas fermer #316 avant le parcours réellement opérationnel.
