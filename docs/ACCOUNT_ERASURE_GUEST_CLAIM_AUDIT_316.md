# #316 — Analyse du mécanisme de revendication invité (2026-11-01)

Inspection **en lecture seule** des fonctions PostgreSQL déployées sur le projet Supabase partagé.

## Fonctions réellement présentes
- `lumen_commands.claim_guest_profile(p_expected_user_id uuid,p_manifest jsonb)` vérifie `auth.uid()`, contrôle le stade de déploiement puis délègue à `claim_guest_profile_v1`.
- `claim_guest_profile_v1` exige une identité authentifiée correspondant à `p_expected_user_id`, valide la structure, la politique et les empreintes du manifeste, sérialise les revendications avec des verrous transactionnels, refuse une modification du manifeste déjà enregistré et enregistre une ligne dans `guest_claim_receipts` uniquement après création d'un profil initial.
- `get_guest_claim` renvoie un reçu au seul utilisateur authentifié correspondant.

## Limite essentielle
Le manifeste contient `sourceRaw`, `seedRaw`, `sourceDigest`, `seedDigest` et `claimId`. Les empreintes vérifient l'intégrité du contenu fourni, **pas la propriété cryptographique d'un identifiant anonyme**. La table ne constitue pas à elle seule un registre fiable des acteurs anonymes historiques.

Le résolveur `createVerifiedActorResolver` exige donc une source de liens d'acteurs réellement vérifiés. **Ne pas** transformer les revendications invitées ou leurs empreintes en associations d'acteurs sans preuve supplémentaire.

## Travail restant avant activation
1. Auditer le format exact des identifiants invités et les preuves d'appartenance déjà persistées dans Lumen.
2. Concevoir un registre de liens authentifiés, avec unicité intercomptes, anti-rejeu et migrations isolées.
3. Tester les comptes historiques sans preuve, les collisions, la récupération multi-appareils et les écritures hors ligne tardives.
4. Connecter ensuite le résolveur, le service privé et le parcours de suppression.
5. Ne jamais effacer `auth.users` sur ce projet partagé avec SoldeZen.

Cette analyse ne modifie aucune donnée utilisateur et n'autorise aucun effacement.
