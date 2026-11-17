# Conditions générales de vente Lumen — projet non publiable en l'état

Version de travail du 16 novembre 2026 (#732). Ce texte prépare la décision du
propriétaire ; il **n'est ni publié ni validé juridiquement**. Les rubriques
**« À valider »** bloquent la première vente réelle. Faits produit repris du code
au 16/11/2026 : `src/campaign/store-catalogue.js`, migrations #728/#729, offre
#731 (`src/ui/adventure-offer.js`).

## 1. Éditeur et objet

Lumen est édité sous le nom commercial **Nopuna** par **Cédric Valente EI**
(coordonnées : [projet de mentions légales](MENTIONS_DRAFT.md)). Les présentes
conditions encadrent l'achat de contenus numériques dans Lumen par un
consommateur.

## 2. Ce qui est vendu

- **La première aventure est gratuite.** Les suivantes sont des contenus
  numériques fournis sans support matériel.
- **« Débloquer cette aventure » : 1 €.** Accès permanent à une aventure, lié au
  compte Lumen.
- **« Tout le vrai ciel » : 5 €.** Accès à toutes les aventures du vrai ciel.
- **Plafond :** les achats à l'unité comptent ; un joueur ne paie jamais plus de
  5 € au total pour le vrai ciel. Au-delà, tout est débloqué.
- **Accès gratuit par la maîtrise :** maîtriser une aventure à 100 % débloque
  gratuitement la suivante. Cet accès n'est pas une vente.
- Les Éclats de lumière et les badges ne s'achètent pas.

## 3. Prix et TVA

Prix en euros, toutes taxes comprises, affichés avant l'achat. Dans l'app
Google Play, le prix affiché par Google fait foi.

**TVA non applicable, art. 293 B du CGI** (franchise en base, confirmée par le
propriétaire le 16/11/2026). Surveiller le seuil de la franchise ; toute vente hors
de France demandera une nouvelle revue.

## 4. Compte et accès

Un compte Lumen est nécessaire pour acheter. Le droit d'accès est enregistré par
le serveur sur ce compte et suit le joueur sur ses appareils. Un achat en attente
de confirmation n'ouvre aucun accès ; l'accès s'ouvre dès la confirmation par le
serveur.

## 5. Paiement

- **App Android (Google Play) :** paiement par Google Play Billing. Google
  traite le paiement ; Lumen reçoit la confirmation et un identifiant d'achat,
  jamais les données de carte.
- **Version web :** paiement non disponible à ce jour (Stripe envisagé, #730).

## 6. Droit de rétractation

Pour un contenu numérique fourni immédiatement, le droit de rétractation de
14 jours ne s'applique pas si le consommateur a **expressément demandé l'accès
immédiat et reconnu perdre son droit de rétractation** avant le paiement
(article L221-28, 13° du Code de la consommation).

**À valider et à implémenter avant la première vente :** l'écran d'achat (#731)
doit recueillir ce consentement de façon expresse (case à cocher non pré-cochée
ou bouton explicite), puis le confirmer sur un support durable (par exemple
l'email de reçu Google Play ou un email Lumen). Sans ce recueil, le droit de
rétractation de 14 jours s'applique.

## 7. Remboursements

Les demandes de remboursement Google Play suivent la politique de Google. Un
achat remboursé ou annulé retire l'accès correspondant (traitement des achats
annulés, #729). La progression déjà réalisée est conservée.

## 8. Garantie légale de conformité

Les contenus numériques bénéficient de la garantie légale de conformité
(articles L224-25-12 et suivants du Code de la consommation). En cas de défaut,
contacter l'éditeur à l'adresse des mentions légales.

## 9. Mineurs

Lumen est accessible à un public mixte incluant des enfants. Un mineur ne peut
acheter qu'avec l'accord d'un parent ou d'un représentant légal. Sur Android, les
parents peuvent exiger leur approbation pour chaque achat grâce au contrôle
parental de Google Play (Family Link). Décision du propriétaire, 16/11/2026.

## 10. Médiation et litiges

**À compléter :** tout vendeur à des consommateurs doit proposer un **médiateur
de la consommation** (article L612-1 du Code de la consommation). Choisir un
médiateur, adhérer, puis indiquer son nom et ses coordonnées ici (options proposées
le 16/11/2026 : CM2C, MEDICYS, CNPM Médiation Consommation ; liste officielle sur
economie.gouv.fr). Droit applicable : droit français.

## 11. Données personnelles

Voir la [politique de confidentialité](CONFIDENTIALITE_DRAFT.md), section
« Projet d'ajout pour les achats (#732) ».

## 12. Message « Sans pub, financé par les joueurs »

La formulation reste une **intention** (financer l'hébergement, les serveurs et
le développement), jamais une promesse d'absence de profit. Vendre reste une
activité commerciale. Le test `adventure-offer-tests.mjs` refuse les
formulations « pas pour gagner de l'argent » ou « sans but lucratif ».

## Avant la première vente réelle — liste de contrôle

Chaque ligne est une décision ou une action du propriétaire, ou une évolution à
livrer :

- [x] Valider ce texte (et la TVA), le publier en HTML (`cgv.html`) dans les deux
  Fait (#732, 17/11/2026) : `cgv.html`, lien « Conditions générales de vente » sous l'offre.
  listes de publication o2switch, puis le lier depuis l'écran d'achat (#731) et
  les mentions légales.
- [ ] Désigner le médiateur de la consommation (section 10) : suivi dans #773. Décision du propriétaire (17/11/2026) : publier sans attendre, ce n'est pas un blocage de `play-readiness`.
- [x] Implémenter et tester le consentement exprès à la renonciation au droit de
  rétractation (section 6).
- [x] Mettre à jour la politique de confidentialité publiée (achats, Google comme
  destinataire, durées de conservation des reçus).
- [x] Mentions légales : préciser l'activité commerciale et la mention « TVA non
  applicable, art. 293 B du CGI ».
- [x] Registre comptable minimal conservé 10 ans après la suppression du compte
  (migration `20261116200000_purchase_accounting_records_732.sql`, à appliquer
  par le propriétaire ; purge quotidienne à programmer).
- [x] `content/legal/publisher.json` : changer `monetization`
  Fait : `paid-content-no-ads`, mention TVA 293 B exigée par `play-readiness`.
  (`free-no-ads-no-purchases` aujourd'hui) puis adapter
  `scripts/play-readiness.mjs` et `scripts/privacy-readiness-tests.mjs`, qui
  bloquent volontairement la publication Play tant que cette valeur n'est pas
  revue.
- [ ] Fiche Google Play : formulaire « Sécurité des données » (achats,
  historique d'achat) et mention des achats intégrés
  ([PLAY_STORE_LISTING_DRAFT](../PLAY_STORE_LISTING_DRAFT.md)).
- [ ] Vérifier que « Sans pub, financé par les joueurs » et le texte « Pourquoi ? »
  restent exacts (section 12).
