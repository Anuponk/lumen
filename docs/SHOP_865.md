# « Tout débloquer » à prix ajusté — activation (#865)

Règle produit : [PROGRESSION](PROGRESSION.md#tout-débloquer-at-an-adjusted-price-865).
Ce document liste uniquement les opérations manuelles du propriétaire. Aucun prix
n'est définitif tant qu'il n'a pas été validé ; rien n'est vendu tant que les produits
restent inactifs côté serveur.

## Choix technique : SKU distincts plutôt qu'offres Play natives

Lumen achète via la TWA (Digital Goods API + Payment Request) et le module Android
vendu dans `android/billing`. `PlayBillingWrapper.launchPaymentFlow` transmet
uniquement l'offre par défaut d'un produit (`getOneTimePurchaseOfferDetails()`), et
`MethodData` ne transporte aucun identifiant d'offre depuis la page web. Utiliser les
options d'achat / offres de réduction natives des produits ponctuels Play demanderait
une nouvelle API wrapper ↔ web, et le serveur ne pourrait pas imposer l'offre réservée
à un palier avant le paiement. Décision : **quatre produits non consommables distincts**,
dont le palier est revérifié par le serveur après paiement.

## Produits

| N achats unitaires confirmés | Produit interne (registre) | ID produit Google Play | Prix proposé (à valider) |
|---|---|---|---|
| 0 | `real-sky-all` | `real_sky_all` (existant) | inchangé |
| 1 | `real-sky-upgrade-1` | `real_sky_upgrade_1` | 4,00 € |
| 2 | `real-sky-upgrade-2` | `real_sky_upgrade_2` | 3,00 € |
| 3 | `real-sky-upgrade-3` | `real_sky_upgrade_3` | 2,00 € |
| 4 | `real-sky-upgrade-4` | `real_sky_upgrade_4` | 1,00 € |
| ≥ 5 ou ciel acquis | — | — | aucun achat |

Les prix proposés reprennent l'écart actuel « ciel 5 € − 1 € par aventure ». Ils sont
**inactifs** dans `lumen_commands.store_products` tant que vous ne les validez pas. Dans
l'application Play, le prix affiché est toujours celui renvoyé par Google Play ; sur le
web, c'est `price_cents` du catalogue serveur, celui que Stripe facture.

## Ordre d'activation

1. **Migration** `supabase/migrations/20261120120000_sky_upgrade_offers_865.sql` :
   à coller tel quel dans l'éditeur SQL Supabase (idempotente, `begin`/`commit`).
   Vérifier ensuite : `select product_id,kind,upgrade_tier,price_cents,active from
   lumen_commands.store_products where kind='sky_upgrade';` → 4 lignes inactives.
2. **Edge Functions** à redéployer depuis la révision fusionnée : `lumen-play-purchase`
   (SKU et contrôle de palier) et `lumen-stripe-checkout` (libellé, `offer_changed`).
   Ordre : migration d'abord, sinon `lumen_sky_upgrade_eligible` est absente.
3. **Play Console** → Monétiser → Produits → Produits ponctuels : créer les quatre IDs
   ci-dessus, type non consommable, titre « Tout le vrai ciel (prix ajusté) »,
   description « Débloque toutes les aventures du ciel principal. Prix ajusté à tes
   aventures déjà achetées. », prix validés, puis **Activer**. Ne pas créer d'offre ni
   d'option d'achat supplémentaire.
4. **Nouvel AAB Android** : `PaymentActivity` n'accepte les SKU `real_sky_upgrade_N`
   qu'à partir de cette révision. Incrémenter `versionCode`, publier en test fermé, puis
   en production. Les anciennes versions ne proposent pas l'upgrade (produit refusé
   avant Google, aucun débit).
5. **Valider puis activer les prix serveur** (même montant que Play en EUR) :
   ```sql
   update lumen_commands.store_products set price_cents=<validé>, active=true
    where product_id='real-sky-upgrade-<N>';
   ```
   Tant qu'un palier est inactif, un joueur à ce palier voit seulement « Choisir ».
6. **Recette** (voir ci-dessous), puis mise à jour des CGV (#818) si les intitulés
   changent.

Retour arrière : `update lumen_commands.store_products set active=false where
kind='sky_upgrade';` retire immédiatement l'offre web et Play (le serveur refuse tout
nouveau jeton d'upgrade inactif ; Google le rembourse faute d'accusé de réception). Les
droits déjà accordés sont conservés.

## Cas limites traités

- **Palier obsolète** (remboursement unitaire entre l'affichage et le paiement, autre
  appareil) : Stripe refuse avant paiement (`offer_changed`) ; Play : jeton non
  enregistré, non acknowledged, remboursé automatiquement par Google sous 3 jours,
  message explicite au joueur.
- **Palier supérieur atteint entre-temps** (N a augmenté) : l'upgrade payé reste
  valable et accorde le ciel.
- **Remboursement de l'upgrade** : retire les droits supplémentaires, conserve les
  achats unitaires et la progression, re-propose le même palier.
- **Achats simultanés** unité + upgrade : les deux restent payés et accordés ; un
  éventuel remboursement commercial se fait manuellement depuis la console.
- **Changement de compte** : N et l'offre sont lus pour le compte Auth courant ; un
  achat Play détenu par un autre compte Lumen n'est jamais transféré (#864).

## Recette courte (achats de test, minimum)

1. Compte de test avec 2 aventures achetées : la boutique montre « Choisir » et
   « Tout débloquer » au prix du palier 2, et la mention « Prix ajusté ».
2. Acheter l'upgrade (carte de test Play ou Stripe test) : tout le ciel principal se
   débloque, les deux achats unitaires restent visibles, aucun troisième achat.
3. Compte avec 5 aventures achetées : aucune offre payante, « Tout le ciel principal
   est débloqué ! ».
