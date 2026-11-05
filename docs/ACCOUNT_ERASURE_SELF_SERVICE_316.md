# #316 — Suppression autonome sécurisée (plan de livraison)

## Protection cliente intégrable sans activation serveur

Le handler de confirmation garde le compte, le client Auth et la génération
de session pendant les attentes. Un propriétaire local non vérifié ou le jeton
d'un autre compte refuse la demande. Une réponse HTTP 200 seule ne permet plus
de nettoyer cet appareil : le JSON doit confirmer `status=erased`, `scope=lumen`
et `details=erased`. Une déconnexion échouée ou une session remplacée conserve
les données locales ; une double soumission ne lance qu'une requête.
La confirmation explicite la perte irréversible de progression, récompenses et
statistiques Lumen, sans exposer les noms de services ou d'applications internes.

Cette protection reprend le correctif client de #611 indépendamment de son
backend privilégié encore en recette. Elle ne modifie ni Edge Function, RPC,
schéma SQL, permissions ou barrières, et n'active aucune suppression serveur.
Les tests du vrai handler utilisent uniquement des frontières fictives ; la
recette positive avec JWT réel et l'activation restent des étapes distinctes.

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
