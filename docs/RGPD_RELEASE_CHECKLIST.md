# RGPD Lumen — état de clôture documentaire (2 novembre 2026)

Ce document suit les preuves disponibles dans le dépôt ; **il ne vaut ni validation juridique ni constat de conformité en production**. Il distingue ce qui est prêt dans le code de ce qui demande une action réelle de l'éditeur. Les données des joueurs et la base partagée ne sont pas modifiées.

## Finalisé dans le dépôt

- Pages accessibles depuis le jeu : [mentions légales](../mentions-legales.html), [confidentialité](../confidentialite.html), [demande de suppression](../supprimer-compte.html). La page de demande prépare un email : **aucune demande n'est envoyée automatiquement** et aucune donnée n'est effacée par cette page.
- Portée publique de la suppression limitée à Lumen, sans exposer la dépendance technique à une autre application. Tests automatisés associés à la PR #612, fusionnée après six contrôles verts.
- Inventaire de catégories, finalités, bases **envisagées** et durées cibles **adoptées le 2 novembre 2026** (PR #614) dans [PRIVACY_RETENTION_PROPOSAL.md](PRIVACY_RETENTION_PROPOSAL.md). La politique cible adoptée ne prouve pas que les purges soient actives.
- Inventaire et limites des sous-traitants dans [PRIVACY_PROCESSORS.md](PRIVACY_PROCESSORS.md) ; procédure d'accès/portabilité [ACCOUNT_RIGHTS_RUNBOOK.md](ACCOUNT_RIGHTS_RUNBOOK.md) et conservation technique [TECHNICAL_RETENTION_RUNBOOK.md](TECHNICAL_RETENTION_RUNBOOK.md) préparées, **non attestées actives**.
- Les mentions légales contiennent des coordonnées déclarées par l'éditeur, à confirmer avant publication finale. Jeu déclaré gratuit, sans publicité ni achats.

## Non clôturable sans preuves supplémentaires

| Sujet | État | Preuve / décision requise |
|---|---|---|
| Suppression autonome réelle (#316, PR #611) | **Bloqué E2E** | Test autorisé sur compte QA, périmètre Lumen uniquement, vérification des résidus et non-régression des autres applications ; ne pas contourner les contrôles de sécurité de migration |
| Bases juridiques et durées | **Durées cibles adoptées (#614), activation non attestée** | Bases par finalité et exceptions à confirmer ; fournir les preuves des tâches réellement actives, sans purger reçus ou progression sur simple hypothèse |
| Droits d'accès, rectification et portabilité | **Procédures préparées** | Canal et responsable de traitement effectifs, test opérateur autorisé, transmission sécurisée ; réponse en principe dans un mois |
| Sous-traitants et transferts | **À confirmer** | Contrats et paramètres effectifs de Supabase, o2switch, Resend, Google et notifications ; preuves des durées fournisseur et localisation des traitements |
| Journaux, sauvegardes et restauration | **À qualifier** | Réglages réels, rotations, copie d'effacements anti-résurrection et test de restauration sans réintroduction d'un compte supprimé |
| Mineurs | **Parcours non validé** | Décision de public cible, parcours parental conforme et preuves de protection ; ne pas activer un compte enfant sur une simple déclaration |
| Google Play / Data Safety (#170) | **Non prêt** | Vérifier les flux de l'application Android réelle, le formulaire Data Safety, les liens publics, les informations de compte et la recette suppression ; ne pas déclarer « conforme » |
| Publication des textes finaux | **Pages candidates** | Vérifier identité de l'éditeur, base juridique par finalité, durées, destinataires, transfert et droits ; retirer les réserves seulement après preuve |

## Mode opératoire léger

1. Pour toute demande de droit : réception au contact public, vérification proportionnée de l'identité/qualité, réponse sous un mois en principe, journal privé minimal sans export brut.
2. Pour une suppression : ne jamais promettre une suppression automatique si la recette E2E est absente ; traiter manuellement par une procédure autorisée et vérifiée ou expliquer clairement la suite au demandeur.
3. Pour chaque nouvelle collecte : renseigner finalité, données, base, destinataires, durée et suppression avant activation. Ne pas confondre permission navigateur et consentement RGPD.
4. Avant Play : refaire l'inventaire sur la version réellement distribuée, contrôler les flux et compléter les preuves de #170.

**Décision de clôture :** le sous-lot documentaire et de clarification publique est terminé ; le chantier juridique/RGPD #316 et la préparation Play #170 restent ouverts. Aucun mécanisme de purge ou de suppression en production n'a été activé par ce document.
