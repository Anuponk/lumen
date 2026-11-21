# Stripe Checkout Web/PWA — mode TEST (#730)

Paiement des aventures par Stripe Checkout sur la version **Web/PWA uniquement**, jamais
dans l'application Google Play (TWA). Cette phase est **strictement en mode test** : aucun
paiement réel n'est possible. La mise en vente réelle demandera une PR et une migration
dédiées, ainsi que la validation juridique (#732).

## Architecture

| Élément | Rôle |
|---|---|
| `supabase/migrations/20261117120000_stripe_checkout_test_730.sql` | Table privée `lumen_commands.stripe_checkout_sessions` (session Stripe ↔ compte, produit, prix serveur, consentement #732), fonctions `lumen_stripe_*` réservées au `service_role`, garde d'ordre des états, réservation aux comptes de test, remise à zéro des données de test, exclusion comptable des paiements de test. |
| `supabase/functions/lumen-stripe-checkout` | Session joueur obligatoire. Modes `checkout` (création), `status` (après le retour Stripe) et `restore` (automatique après chaque connexion : relit les sessions non réglées). |
| `supabase/functions/lumen-stripe-webhook` | Événements Stripe signés. Relit l'état réel auprès de Stripe puis l'enregistre. |
| `supabase/functions/_shared/lumen-stripe.ts` | Signature HMAC, appels API Stripe, lecture de l'état réel d'une session. |
| `src/persistence/stripe-checkout.js` | Client : disponibilité Web seulement, ouverture du Checkout, retour, attente de la confirmation serveur, messages. |

Les droits passent **uniquement** par le registre existant #728
(`lumen_commands.record_purchase`, `provider='stripe'`, `provider_ref` = identifiant de
la Checkout Session `cs_test_…`) puis `sync_purchase_entitlements`. Aucun second registre
ni seconde logique de droits n'est créé.

### Parcours

1. Le joueur coche la renonciation (#732), puis choisit « Débloquer cette aventure · 1 € » ou
   « Tout le vrai ciel · 5 € ». Le navigateur n'envoie **que** l'identifiant du produit et
   l'acceptation de la renonciation.
2. `lumen-stripe-checkout` vérifie la session Supabase, puis `lumen_stripe_checkout_begin`
   contrôle : compte de test, produit actif, prix et devise lus dans `store_products`,
   aventure déjà possédée (achat, maîtrise ou administrateur), règle « tout le ciel » après un
   achat à l'unité (#729), une seule session en cours par compte, 10 sessions par heure au plus.
3. La fonction crée une session Checkout `mode=payment` avec ce prix (clé
   d'idempotence = réservation), lie la session au compte et renvoie l'URL Stripe.
4. Retour vers `https://lumen.nopuna.fr/?lumen_checkout=success&session_id=…` (ou
   `?lumen_checkout=cancel`). Le client retire ces paramètres de l'adresse et **interroge le
   serveur** (`mode=status`), qui relit la session chez Stripe. « Achat confirmé ✓ » n'apparaît
   qu'après l'état `paid` côté serveur et le rechargement des droits, suivi de la fenêtre
   « Merci pour ton soutien ✨ ». Aucun bouton « Restaurer mes achats » : après chaque
   connexion, Lumen relit automatiquement les sessions non réglées (webhook manqué).
5. Le webhook fait la même relecture à chaque événement : un événement n'est qu'un signal,
   jamais une source de vérité.

### Garanties

- **Prix :** uniquement le catalogue serveur ; le montant, la devise, le produit et le compte
  relus chez Stripe doivent correspondre à la réservation (`session identity conflict`
  sinon). Un montant envoyé par le navigateur est ignoré.
- **Doublons :** `record_purchase` est idempotent par `(provider, provider_ref)` ; un webhook
  rejoué ne crée ni achat ni événement supplémentaire.
- **Désordre :** chaque session a un rang monotone : en attente 1 < échec/expirée 2 < payé 3 <
  litige ouvert 4 < litige clos (gagné → payé, perdu → contesté) 5 < remboursé 6. Un état plus
  ancien est ignoré (`stale`) : un « payé » tardif après un remboursement ne rend jamais le droit.
- **Remboursement total :** le droit `purchase` expire (la ligne est conservée), la progression,
  les étoiles et les badges ne sont jamais touchés. Les droits `admin` et `mastery` restent.
  **Remboursement partiel :** considéré comme un geste commercial, l'accès est conservé.
  Pour retirer l'accès, rembourser la totalité.
- **Litige :** ouvert ou perdu → pas de droit ; gagné → droit rétabli.
- **Paiement refusé, annulé, expiré ou différé en échec :** rien n'est enregistré au registre.
- **Erreurs temporaires :** Stripe ou la base indisponible → réponse 5xx, Stripe réessaie.
- **Compte :** un joueur ne peut consulter ni revendiquer que ses propres sessions ; la
  session Stripe porte `client_reference_id` et `metadata[lumen_user_id]`, qui doivent
  concorder avec la réservation.

### Séparation test / production

- Clés : seules `sk_test_…` ou `rk_test_…` sont acceptées. Une clé `sk_live_`/`rk_live_`
  désactive les deux fonctions (503) et n'est jamais journalisée.
- Événements : `livemode=true` est refusé (400) ; une session `cs_live_…` n'est jamais lue.
- Base : `stripe_checkout_sessions.livemode` est contraint à `false`.
- **Comptes réels protégés :** la base SoldeZen contient des joueurs réels. Avec une clé de
  test, n'importe qui pourrait « payer » avec une carte fictive ; le paiement n'est donc
  proposé et accepté **que** pour les comptes portant la capacité interne
  `stripe_test_checkout` (`lumen.internal_capabilities`), vérifiée par le serveur. Les joueurs
  réels voient toujours « Paiement bientôt disponible ».
- Les achats de test sont identifiables (`provider='stripe'` et `provider_ref like 'cs_test_%'`),
  ne sont **jamais** archivés comme écritures comptables (#732) et se suppriment avec
  `lumen_commands.stripe_test_reset(<uuid>)`.
- Alternative plus forte, non retenue pour cette phase : un projet Supabase de test dédié
  (toutes les migrations à rejouer, secrets et URL distincts). À envisager si des tests
  plus larges sont nécessaires.

### Isolation Google Play

Stripe n'est jamais proposé quand Lumen tourne dans l'application Play : service Google Play
Billing effectivement obtenu, `window.LUMEN_NATIVE_APP`, ou lancement par un référent
`android-app://` (mémorisé pour l'onglet). La seule présence de `getDigitalGoodsService` ne
compte pas : Chrome Android l'expose aussi hors de l'application (correctif du 17/11/2026). Aucun lien vers le Web n'est affiché dans l'application.

## Opérations du propriétaire

Rien de ce qui suit n'a été réalisé par l'agent. Les secrets ne doivent jamais apparaître
dans GitHub, une issue ou une conversation.

### 1. Appliquer la migration (après relecture)

Éditeur SQL Supabase, projet SoldeZen : exécuter
`supabase/migrations/20261117120000_stripe_checkout_test_730.sql` (rejouable). Contrôle :

```sql
select to_regclass('lumen_commands.stripe_checkout_sessions') is not null as table_ok,
 has_function_privilege('authenticated','public.lumen_stripe_record_session(text,uuid,text,integer,text,boolean,text,boolean,text,timestamptz)','EXECUTE') as players_can_record; -- attendu : true, false
```

### 2. Déployer les deux fonctions

```sh
supabase functions deploy lumen-stripe-checkout --project-ref tjdjlavmusmncuszhsuw
supabase functions deploy lumen-stripe-webhook --project-ref tjdjlavmusmncuszhsuw --no-verify-jwt
```

`--no-verify-jwt` est **obligatoire** pour le webhook (Stripe n'a pas de jeton Supabase ;
l'authenticité vient de la signature). Le dossier `_shared` est inclus automatiquement.

### 3. Créer la destination webhook dans le Sandbox `Lumen - Development`

Stripe Dashboard (sandbox) → Développeurs → Webhooks → **Ajouter une destination** :

- **URL :** `https://tjdjlavmusmncuszhsuw.supabase.co/functions/v1/lumen-stripe-webhook`
- **Événements :**
  - `checkout.session.completed`
  - `checkout.session.async_payment_succeeded`
  - `checkout.session.async_payment_failed`
  - `checkout.session.expired`
  - `charge.refunded`
  - `charge.dispute.created`
  - `charge.dispute.updated`
  - `charge.dispute.closed`
- Version d'API : indifférente (la fonction relit la session avec sa propre version).

Ouvrir la destination → **Secret de signature** → Révéler → copier la valeur `whsec_…`.

### 4. Enregistrer le secret de signature

Supabase → Edge Functions → Secrets : `STRIPE_WEBHOOK_SECRET` = la valeur `whsec_…`.
`STRIPE_SECRET_KEY` (clé `sk_test_…`) est déjà en place. Ne pas confondre les deux.

### 5. Préparer un compte de test dédié

Créer un compte Lumen **réservé aux essais** (jamais un compte de joueur réel), puis :

```sql
-- UUID du compte de test (Authentication → Users)
insert into lumen.internal_capabilities(user_id,capability,source)
values ('<uuid-du-compte-de-test>','stripe_test_checkout','manual')
on conflict (user_id,capability) do update set expires_at=null;
```

Éviter un compte administrateur (`all_adventures_access` rend toutes les aventures
accessibles et masque l'effet de l'achat).

### 6. Paiement fictif de 1 €

Sur `https://lumen.nopuna.fr` dans un navigateur (pas l'application Play), connecté avec le
compte de test : toucher l'aventure 2 → cocher la renonciation → « Débloquer cette aventure
· 1,00 € ». Cartes fictives Stripe (date future quelconque, CVC quelconque) :

| Carte | Résultat attendu |
|---|---|
| `4242 4242 4242 4242` | payé : « Achat confirmé ✓ », l'aventure s'ouvre |
| `4000 0000 0000 0002` | refusée sur la page Stripe, rien n'est enregistré |
| `4000 0025 0000 3155` | authentification 3-D Secure, puis payé |

Bouton retour ou « ← » sur Stripe : « Paiement annulé : aucun achat n'a été enregistré. »

### 7. Vérifier le registre

```sql
select s.session_id,s.product_id,s.amount_cents,s.status,s.state_rank,s.created_at
from lumen_commands.stripe_checkout_sessions s where s.user_id='<uuid>' order by s.created_at desc;
select p.provider_ref,p.product_id,p.amount_cents,p.currency,p.status,
 (select count(*) from lumen_commands.purchase_events e where e.purchase_id=p.id) as events
from lumen_commands.purchases p where p.user_id='<uuid>' and p.provider='stripe';
select entitlement,source,expires_at from lumen.entitlements where user_id='<uuid>' order by entitlement;
```

Attendu après le paiement : un achat `paid`, 100 centimes, 1 événement ; droit
`real-adventure-02` source `purchase`, `expires_at` vide.

### 8. Rejouer le webhook

Dashboard → Webhooks → destination → événement `checkout.session.completed` → **Renvoyer**.
Les requêtes du point 7 doivent rester identiques (toujours 1 achat, 1 événement).

### 9. Remboursement

Dashboard → Paiements → le paiement → **Rembourser** (montant total). Après le webhook
`charge.refunded` : achat `refunded`, 2 événements, droit avec `expires_at` renseigné.
La progression reste intacte (quêtes, étoiles, badges). Renvoyer l'ancien
`checkout.session.completed` : rien ne change (état `stale`).

### 10. Nettoyage et retrait

```sql
select lumen_commands.stripe_test_reset('<uuid>'); -- supprime uniquement les données Stripe TEST de ce compte
delete from lumen.internal_capabilities where user_id='<uuid>' and capability='stripe_test_checkout';
```

## Limites connues

- Apple Pay / Google Pay dans Checkout dépendent de l'activation des moyens de paiement et
  de l'enregistrement du domaine dans Stripe ; la carte suffit pour cette phase.
- TVA (Stripe Tax ou OSS) non configurée : décision #732.
- Pages légales (`confidentialite.html`, `mentions-legales.html`) encore candidates : à valider
  avant toute vente réelle (#732, #773). Le brouillon `docs/legal/CONFIDENTIALITE_DRAFT.md`
  mentionne désormais Stripe.
- Détection de l'application Play : si une future version de l'application ne fournit ni le service
  Google Play Billing ni le référent `android-app://`, Stripe pourrait y apparaître pour un compte
  de test. Sans effet pour les joueurs réels pendant cette phase.
- Si deux onglets ouvrent des sessions différentes, la précédente est expirée chez Stripe ; si
  elle a été payée malgré tout, le paiement est tout de même enregistré (aucune perte).

## Passage en vente réelle

Le code est prêt mais **verrouillé** : migration `20261117180000_stripe_live_switch_730.sql`,
interrupteur `lumen_commands.feature_flags` `stripe_live` **désactivé par défaut**.

- Le mode Stripe vient de la clé : `sk_test_`/`rk_test_` (test) ou `sk_live_`/`rk_live_` (réel).
  Les événements et les sessions doivent être du même mode que la clé (400 `mode_mismatch` sinon).
- Clé réelle **et** interrupteur activé : tout joueur connecté sur le Web peut acheter. Interrupteur
  désactivé : aucune session réelle n'est créée, même avec une clé réelle (`not_eligible`).
- Le mode fait partie de l'identité d'une session : un paiement de test ne peut jamais être
  enregistré comme réel. Les ventes réelles sont archivées en comptabilité (#732) ;
  `stripe_test_reset` n'y touche jamais.
- `public.lumen_payment_channel()` indique au client `live`, `test` ou `off` pour le joueur
  connecté ; il n'accorde jamais rien.
- Chaque paiement crée une **facture Stripe** dont le pied de page reprend la demande d'accès
  immédiat, la renonciation (art. L221-28, 13°) et « TVA non applicable, art. 293 B du CGI » :
  c'est la confirmation par email promise par les CGV (§6). La facturation Stripe peut être
  payante (voir la grille tarifaire Stripe Invoicing).

### Ordre d'activation (propriétaire)

1. **Médiateur** : souscrire (CM2C prévu), puis remplacer « en cours de désignation » dans
   `cgv.html` par ses coordonnées (#773). L'information doit précéder la vente.
2. **Compte Stripe** : activer le compte (identité, Cédric Valente EI, SIRET, IBAN). Dans
   Paramètres → Emails clients, activer l'envoi des **paiements réussis** et des **factures**.
3. Appliquer la migration `20261117180000_stripe_live_switch_730.sql` (éditeur SQL) ; l'interrupteur
   reste désactivé.
4. Stripe en mode réel → Webhooks → nouvelle destination
   `https://tjdjlavmusmncuszhsuw.supabase.co/functions/v1/lumen-stripe-webhook`, mêmes 8 événements.
   Révéler son secret.
5. Supabase → Secrets : remplacer `STRIPE_SECRET_KEY` par la clé `sk_live_…` et
   `STRIPE_WEBHOOK_SECRET` par le secret de la destination réelle (même moment ; ils vont par paire).
6. Activer :
   `update lumen_commands.feature_flags set enabled=true,updated_at=now() where name='stripe_live';`
7. Achat réel de 1 € avec ton propre compte, vérification du registre (requêtes du point 7 de la
   recette), puis remboursement depuis Stripe.

**Retour arrière immédiat** : `update lumen_commands.feature_flags set enabled=false … where name='stripe_live';`
(aucune nouvelle session réelle ; les paiements en cours restent traités par le webhook). Pour
refaire des tests, remettre la paire clé `sk_test_` / secret de la destination de test.
