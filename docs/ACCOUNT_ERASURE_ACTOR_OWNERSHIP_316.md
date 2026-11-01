# #316 — Vérification des associations de profils invités (2026-11-01)

## Constat sur Supabase partagé
Inspection en lecture seule du projet hébergeant Lumen : la table
`lumen_commands.guest_claim_receipts` contient les colonnes
`claim_id uuid`, `user_id uuid`, `manifest jsonb`, `created_at timestamptz`,
mais **aucune ligne** au moment de l'inspection.

Il n'existe donc pas, dans cette table, de preuve exploitable permettant
d'attribuer des identifiants invités historiques à un utilisateur connecté.
Les événements analytiques, l'email, le stockage local et la simple présence
d'un identifiant dans un manifeste non authentifié ne prouvent pas la propriété.

## Conséquences pour l'effacement autonome
- Ne jamais inférer les acteurs invités à partir des événements analytiques.
- Ne jamais accepter des identifiants invités fournis par le navigateur.
- Tant qu'un mécanisme de liaison vérifiée n'est pas disponible, le résolveur
  doit refuser les associations non prouvées.
- Un tableau de justificatifs vide ne signifie **pas** que le joueur n'a jamais
  joué en invité. Une suppression complète ne peut être affirmée sur cette base.
- Conserver la PR en brouillon et la suppression automatique désactivée.

## Pour débloquer la livraison
1. Identifier dans le code Lumen le flux de revendication des données invitées.
2. Enregistrer au moment de la revendication une preuve vérifiée côté serveur,
   liée à l'utilisateur authentifié, avec protection contre les doubles
   revendications et collisions intercomptes.
3. Prévoir un traitement conservateur des comptes historiques sans preuve,
   avec procédure de vérification assistée.
4. Tester l'ensemble sur une base isolée, notamment deux comptes revendiquant
   le même acteur et la réapparition d'une écriture hors ligne.

Aucune donnée utilisateur n'a été modifiée pendant cette inspection.
