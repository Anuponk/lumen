# Validation des 380 nouvelles quêtes

Généré par `node scripts/validate-iau-completion.mjs --write`. Chaque grille a été recomptée et résolue depuis une grille vide par le moteur de preuves. Les rotations, symétries et renommages des régions sont dédupliqués face au catalogue existant. Aucun singleton dans les nouvelles grilles.

Le score mesure la preuve logique du moteur, pas un temps humain. Les paliers se chevauchent aux égalités ; chaque constellation et chaque aventure suivent une courbe non décroissante. Les tailles candidates sont réparties globalement selon ce score. Les familles décrivent la stratégie de génération ; les formes restent toutes distinctes.

| Aventure | Constellations | Quêtes | Score min–max | Moyenne | Tailles 8/9/10 | Familles |
|---|---:|---:|---|---:|---|---|
| 6 · Les artisans de la lumière | 10 | 100 | 119–159 | 133.95 | 90/10/0 | mosaic: 75, hybrid: 15, classic: 10 |
| 7 · Les voyageurs de l’aube | 10 | 100 | 159–168 | 164.2 | 0/100/0 | mosaic: 98, hybrid: 2 |
| 8 · Les gardiens de l’immensité | 10 | 100 | 168–202 | 173.47 | 0/92/8 | mosaic: 99, hybrid: 1 |
| 9 · Le ciel réuni | 8 | 80 | 202–219 | 208.97 | 0/0/80 | mosaic: 80 |

## Diversité mesurée

Les écarts-types des tailles des régions et les nombres de frontières varient dans chaque aventure. Les profils de règles sont les mélanges distincts de déductions effectivement rejouées ; les comptes par règle sont cumulés. Toute disparition de cette variété fait échouer le contrôle.

| Aventure | Écart-type des tailles des régions | Frontières | Profils de règles distincts | Déductions cumulées |
|---|---|---|---:|---|
| 6 | 6.614–18.744 | 29–51 | 45 | locked: 2827, group: 2852, single: 810 |
| 7 | 9.416–19.448 | 36–55 | 32 | locked: 3933, group: 3179, single: 900 |
| 8 | 8.807–22.672 | 38–55 | 25 | locked: 3380, group: 3943, single: 908 |
| 9 | 11.109–24 | 42–67 | 27 | locked: 3615, group: 3571, single: 800 |

| Aventure | Constellation | Quête | Difficulté (score) | Taille | Solution unique | Validation | Anomalies |
|---|---|---|---|---|---|---|---|
| 6 | Fourneau | pack-real-adventure-06-q001 | Expert (119) | 8 | Oui | Preuve 60 étapes | Aucune |
| 6 | Fourneau | pack-real-adventure-06-q002 | Expert (125) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Fourneau | pack-real-adventure-06-q003 | Expert (128) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Fourneau | pack-real-adventure-06-q004 | Expert (129) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Fourneau | pack-real-adventure-06-q005 | Expert (131) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Fourneau | pack-real-adventure-06-q006 | Expert (132) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Fourneau | pack-real-adventure-06-q007 | Expert (134) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Fourneau | pack-real-adventure-06-q008 | Expert (136) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Fourneau | pack-real-adventure-06-q009 | Expert (138) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Fourneau | pack-real-adventure-06-q010 | Expert (154) | 9 | Oui | Preuve 79 étapes | Aucune |
| 6 | Horloge | pack-real-adventure-06-q011 | Expert (121) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Horloge | pack-real-adventure-06-q012 | Expert (126) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Horloge | pack-real-adventure-06-q013 | Expert (128) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Horloge | pack-real-adventure-06-q014 | Expert (129) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Horloge | pack-real-adventure-06-q015 | Expert (131) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Horloge | pack-real-adventure-06-q016 | Expert (133) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Horloge | pack-real-adventure-06-q017 | Expert (134) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Horloge | pack-real-adventure-06-q018 | Expert (136) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Horloge | pack-real-adventure-06-q019 | Expert (138) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Horloge | pack-real-adventure-06-q020 | Expert (154) | 9 | Oui | Preuve 79 étapes | Aucune |
| 6 | Réticule | pack-real-adventure-06-q021 | Expert (122) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Réticule | pack-real-adventure-06-q022 | Expert (126) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Réticule | pack-real-adventure-06-q023 | Expert (128) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Réticule | pack-real-adventure-06-q024 | Expert (130) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Réticule | pack-real-adventure-06-q025 | Expert (131) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Réticule | pack-real-adventure-06-q026 | Expert (133) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Réticule | pack-real-adventure-06-q027 | Expert (134) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Réticule | pack-real-adventure-06-q028 | Expert (136) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Réticule | pack-real-adventure-06-q029 | Expert (138) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Réticule | pack-real-adventure-06-q030 | Expert (155) | 9 | Oui | Preuve 78 étapes | Aucune |
| 6 | Peintre | pack-real-adventure-06-q031 | Expert (122) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Peintre | pack-real-adventure-06-q032 | Expert (126) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Peintre | pack-real-adventure-06-q033 | Expert (128) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Peintre | pack-real-adventure-06-q034 | Expert (130) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Peintre | pack-real-adventure-06-q035 | Expert (131) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Peintre | pack-real-adventure-06-q036 | Expert (133) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Peintre | pack-real-adventure-06-q037 | Expert (134) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Peintre | pack-real-adventure-06-q038 | Expert (136) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Peintre | pack-real-adventure-06-q039 | Expert (138) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Peintre | pack-real-adventure-06-q040 | Expert (156) | 9 | Oui | Preuve 79 étapes | Aucune |
| 6 | Sculpteur | pack-real-adventure-06-q041 | Expert (123) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Sculpteur | pack-real-adventure-06-q042 | Expert (126) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Sculpteur | pack-real-adventure-06-q043 | Expert (128) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Sculpteur | pack-real-adventure-06-q044 | Expert (130) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Sculpteur | pack-real-adventure-06-q045 | Expert (131) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Sculpteur | pack-real-adventure-06-q046 | Expert (133) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Sculpteur | pack-real-adventure-06-q047 | Expert (135) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Sculpteur | pack-real-adventure-06-q048 | Expert (136) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Sculpteur | pack-real-adventure-06-q049 | Expert (138) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Sculpteur | pack-real-adventure-06-q050 | Expert (158) | 9 | Oui | Preuve 79 étapes | Aucune |
| 6 | Microscope | pack-real-adventure-06-q051 | Expert (123) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Microscope | pack-real-adventure-06-q052 | Expert (127) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Microscope | pack-real-adventure-06-q053 | Expert (128) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Microscope | pack-real-adventure-06-q054 | Expert (130) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Microscope | pack-real-adventure-06-q055 | Expert (131) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Microscope | pack-real-adventure-06-q056 | Expert (133) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Microscope | pack-real-adventure-06-q057 | Expert (135) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Microscope | pack-real-adventure-06-q058 | Expert (137) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Microscope | pack-real-adventure-06-q059 | Expert (140) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Microscope | pack-real-adventure-06-q060 | Expert (158) | 9 | Oui | Preuve 79 étapes | Aucune |
| 6 | Télescope | pack-real-adventure-06-q061 | Expert (123) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Télescope | pack-real-adventure-06-q062 | Expert (127) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Télescope | pack-real-adventure-06-q063 | Expert (129) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Télescope | pack-real-adventure-06-q064 | Expert (130) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Télescope | pack-real-adventure-06-q065 | Expert (132) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Télescope | pack-real-adventure-06-q066 | Expert (133) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Télescope | pack-real-adventure-06-q067 | Expert (135) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Télescope | pack-real-adventure-06-q068 | Expert (137) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Télescope | pack-real-adventure-06-q069 | Expert (140) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Télescope | pack-real-adventure-06-q070 | Expert (158) | 9 | Oui | Preuve 79 étapes | Aucune |
| 6 | Compas | pack-real-adventure-06-q071 | Expert (124) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Compas | pack-real-adventure-06-q072 | Expert (127) | 8 | Oui | Preuve 61 étapes | Aucune |
| 6 | Compas | pack-real-adventure-06-q073 | Expert (129) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Compas | pack-real-adventure-06-q074 | Expert (130) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Compas | pack-real-adventure-06-q075 | Expert (132) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Compas | pack-real-adventure-06-q076 | Expert (134) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Compas | pack-real-adventure-06-q077 | Expert (135) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Compas | pack-real-adventure-06-q078 | Expert (137) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Compas | pack-real-adventure-06-q079 | Expert (141) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Compas | pack-real-adventure-06-q080 | Expert (158) | 9 | Oui | Preuve 79 étapes | Aucune |
| 6 | Règle | pack-real-adventure-06-q081 | Expert (124) | 8 | Oui | Preuve 61 étapes | Aucune |
| 6 | Règle | pack-real-adventure-06-q082 | Expert (127) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Règle | pack-real-adventure-06-q083 | Expert (129) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Règle | pack-real-adventure-06-q084 | Expert (130) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Règle | pack-real-adventure-06-q085 | Expert (132) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Règle | pack-real-adventure-06-q086 | Expert (134) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Règle | pack-real-adventure-06-q087 | Expert (135) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Règle | pack-real-adventure-06-q088 | Expert (137) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Règle | pack-real-adventure-06-q089 | Expert (142) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Règle | pack-real-adventure-06-q090 | Expert (159) | 9 | Oui | Preuve 81 étapes | Aucune |
| 6 | Sextant | pack-real-adventure-06-q091 | Expert (125) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Sextant | pack-real-adventure-06-q092 | Expert (128) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Sextant | pack-real-adventure-06-q093 | Expert (129) | 8 | Oui | Preuve 62 étapes | Aucune |
| 6 | Sextant | pack-real-adventure-06-q094 | Expert (131) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Sextant | pack-real-adventure-06-q095 | Expert (132) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Sextant | pack-real-adventure-06-q096 | Expert (134) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Sextant | pack-real-adventure-06-q097 | Expert (135) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Sextant | pack-real-adventure-06-q098 | Expert (137) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Sextant | pack-real-adventure-06-q099 | Expert (142) | 8 | Oui | Preuve 64 étapes | Aucune |
| 6 | Sextant | pack-real-adventure-06-q100 | Expert (159) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Boussole | pack-real-adventure-07-q001 | Expert (159) | 9 | Oui | Preuve 78 étapes | Aucune |
| 7 | Boussole | pack-real-adventure-07-q002 | Expert (161) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Boussole | pack-real-adventure-07-q003 | Expert (162) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Boussole | pack-real-adventure-07-q004 | Expert (163) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Boussole | pack-real-adventure-07-q005 | Expert (164) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Boussole | pack-real-adventure-07-q006 | Expert (165) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Boussole | pack-real-adventure-07-q007 | Expert (165) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Boussole | pack-real-adventure-07-q008 | Expert (166) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Boussole | pack-real-adventure-07-q009 | Expert (167) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Boussole | pack-real-adventure-07-q010 | Expert (167) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Poisson volant | pack-real-adventure-07-q011 | Expert (160) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Poisson volant | pack-real-adventure-07-q012 | Expert (161) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Poisson volant | pack-real-adventure-07-q013 | Expert (162) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Poisson volant | pack-real-adventure-07-q014 | Expert (163) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Poisson volant | pack-real-adventure-07-q015 | Expert (164) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Poisson volant | pack-real-adventure-07-q016 | Expert (165) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Poisson volant | pack-real-adventure-07-q017 | Expert (165) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Poisson volant | pack-real-adventure-07-q018 | Expert (166) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Poisson volant | pack-real-adventure-07-q019 | Expert (167) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Poisson volant | pack-real-adventure-07-q020 | Expert (167) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Mouche | pack-real-adventure-07-q021 | Expert (160) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Mouche | pack-real-adventure-07-q022 | Expert (161) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Mouche | pack-real-adventure-07-q023 | Expert (162) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Mouche | pack-real-adventure-07-q024 | Expert (163) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Mouche | pack-real-adventure-07-q025 | Expert (164) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Mouche | pack-real-adventure-07-q026 | Expert (165) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Mouche | pack-real-adventure-07-q027 | Expert (165) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Mouche | pack-real-adventure-07-q028 | Expert (166) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Mouche | pack-real-adventure-07-q029 | Expert (167) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Mouche | pack-real-adventure-07-q030 | Expert (167) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Indien | pack-real-adventure-07-q031 | Expert (160) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Indien | pack-real-adventure-07-q032 | Expert (161) | 9 | Oui | Preuve 80 étapes | Aucune |
| 7 | Indien | pack-real-adventure-07-q033 | Expert (162) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Indien | pack-real-adventure-07-q034 | Expert (163) | 9 | Oui | Preuve 78 étapes | Aucune |
| 7 | Indien | pack-real-adventure-07-q035 | Expert (164) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Indien | pack-real-adventure-07-q036 | Expert (165) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Indien | pack-real-adventure-07-q037 | Expert (166) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Indien | pack-real-adventure-07-q038 | Expert (166) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Indien | pack-real-adventure-07-q039 | Expert (167) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Indien | pack-real-adventure-07-q040 | Expert (167) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Toucan | pack-real-adventure-07-q041 | Expert (160) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Toucan | pack-real-adventure-07-q042 | Expert (161) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Toucan | pack-real-adventure-07-q043 | Expert (162) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Toucan | pack-real-adventure-07-q044 | Expert (163) | 9 | Oui | Preuve 80 étapes | Aucune |
| 7 | Toucan | pack-real-adventure-07-q045 | Expert (164) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Toucan | pack-real-adventure-07-q046 | Expert (165) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Toucan | pack-real-adventure-07-q047 | Expert (166) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Toucan | pack-real-adventure-07-q048 | Expert (166) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Toucan | pack-real-adventure-07-q049 | Expert (167) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Toucan | pack-real-adventure-07-q050 | Expert (167) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Paon | pack-real-adventure-07-q051 | Expert (160) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Paon | pack-real-adventure-07-q052 | Expert (161) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Paon | pack-real-adventure-07-q053 | Expert (162) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Paon | pack-real-adventure-07-q054 | Expert (163) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Paon | pack-real-adventure-07-q055 | Expert (164) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Paon | pack-real-adventure-07-q056 | Expert (165) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Paon | pack-real-adventure-07-q057 | Expert (166) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Paon | pack-real-adventure-07-q058 | Expert (166) | 9 | Oui | Preuve 78 étapes | Aucune |
| 7 | Paon | pack-real-adventure-07-q059 | Expert (167) | 9 | Oui | Preuve 77 étapes | Aucune |
| 7 | Paon | pack-real-adventure-07-q060 | Expert (167) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Phénix | pack-real-adventure-07-q061 | Expert (160) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Phénix | pack-real-adventure-07-q062 | Expert (162) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Phénix | pack-real-adventure-07-q063 | Expert (162) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Phénix | pack-real-adventure-07-q064 | Expert (164) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Phénix | pack-real-adventure-07-q065 | Expert (164) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Phénix | pack-real-adventure-07-q066 | Expert (165) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Phénix | pack-real-adventure-07-q067 | Expert (166) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Phénix | pack-real-adventure-07-q068 | Expert (166) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Phénix | pack-real-adventure-07-q069 | Expert (167) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Phénix | pack-real-adventure-07-q070 | Expert (167) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Carène | pack-real-adventure-07-q071 | Expert (160) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Carène | pack-real-adventure-07-q072 | Expert (162) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Carène | pack-real-adventure-07-q073 | Expert (162) | 9 | Oui | Preuve 80 étapes | Aucune |
| 7 | Carène | pack-real-adventure-07-q074 | Expert (164) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Carène | pack-real-adventure-07-q075 | Expert (164) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Carène | pack-real-adventure-07-q076 | Expert (165) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Carène | pack-real-adventure-07-q077 | Expert (166) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Carène | pack-real-adventure-07-q078 | Expert (167) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Carène | pack-real-adventure-07-q079 | Expert (167) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Carène | pack-real-adventure-07-q080 | Expert (167) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Poupe | pack-real-adventure-07-q081 | Expert (160) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Poupe | pack-real-adventure-07-q082 | Expert (162) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Poupe | pack-real-adventure-07-q083 | Expert (162) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Poupe | pack-real-adventure-07-q084 | Expert (164) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Poupe | pack-real-adventure-07-q085 | Expert (164) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Poupe | pack-real-adventure-07-q086 | Expert (165) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Poupe | pack-real-adventure-07-q087 | Expert (166) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Poupe | pack-real-adventure-07-q088 | Expert (167) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Poupe | pack-real-adventure-07-q089 | Expert (167) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Poupe | pack-real-adventure-07-q090 | Expert (167) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Voiles | pack-real-adventure-07-q091 | Expert (160) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Voiles | pack-real-adventure-07-q092 | Expert (162) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Voiles | pack-real-adventure-07-q093 | Expert (163) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Voiles | pack-real-adventure-07-q094 | Expert (164) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Voiles | pack-real-adventure-07-q095 | Expert (165) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Voiles | pack-real-adventure-07-q096 | Expert (165) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Voiles | pack-real-adventure-07-q097 | Expert (166) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Voiles | pack-real-adventure-07-q098 | Expert (167) | 9 | Oui | Preuve 79 étapes | Aucune |
| 7 | Voiles | pack-real-adventure-07-q099 | Expert (167) | 9 | Oui | Preuve 81 étapes | Aucune |
| 7 | Voiles | pack-real-adventure-07-q100 | Expert (168) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Lion | pack-real-adventure-08-q001 | Expert (168) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Lion | pack-real-adventure-08-q002 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Lion | pack-real-adventure-08-q003 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Lion | pack-real-adventure-08-q004 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Lion | pack-real-adventure-08-q005 | Expert (170) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Lion | pack-real-adventure-08-q006 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Lion | pack-real-adventure-08-q007 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Lion | pack-real-adventure-08-q008 | Expert (173) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Lion | pack-real-adventure-08-q009 | Expert (174) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Lion | pack-real-adventure-08-q010 | Expert (178) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Lynx | pack-real-adventure-08-q011 | Expert (168) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Lynx | pack-real-adventure-08-q012 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Lynx | pack-real-adventure-08-q013 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Lynx | pack-real-adventure-08-q014 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Lynx | pack-real-adventure-08-q015 | Expert (170) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Lynx | pack-real-adventure-08-q016 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Lynx | pack-real-adventure-08-q017 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Lynx | pack-real-adventure-08-q018 | Expert (173) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Lynx | pack-real-adventure-08-q019 | Expert (175) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Lynx | pack-real-adventure-08-q020 | Expert (179) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Renard | pack-real-adventure-08-q021 | Expert (168) | 9 | Oui | Preuve 79 étapes | Aucune |
| 8 | Petit Renard | pack-real-adventure-08-q022 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Renard | pack-real-adventure-08-q023 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Renard | pack-real-adventure-08-q024 | Expert (170) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Renard | pack-real-adventure-08-q025 | Expert (170) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Renard | pack-real-adventure-08-q026 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Renard | pack-real-adventure-08-q027 | Expert (171) | 9 | Oui | Preuve 79 étapes | Aucune |
| 8 | Petit Renard | pack-real-adventure-08-q028 | Expert (173) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Renard | pack-real-adventure-08-q029 | Expert (175) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Petit Renard | pack-real-adventure-08-q030 | Expert (197) | 10 | Oui | Preuve 97 étapes | Aucune |
| 8 | Chevelure de Bérénice | pack-real-adventure-08-q031 | Expert (168) | 9 | Oui | Preuve 79 étapes | Aucune |
| 8 | Chevelure de Bérénice | pack-real-adventure-08-q032 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Chevelure de Bérénice | pack-real-adventure-08-q033 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Chevelure de Bérénice | pack-real-adventure-08-q034 | Expert (170) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Chevelure de Bérénice | pack-real-adventure-08-q035 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Chevelure de Bérénice | pack-real-adventure-08-q036 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Chevelure de Bérénice | pack-real-adventure-08-q037 | Expert (172) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Chevelure de Bérénice | pack-real-adventure-08-q038 | Expert (173) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Chevelure de Bérénice | pack-real-adventure-08-q039 | Expert (175) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Chevelure de Bérénice | pack-real-adventure-08-q040 | Expert (199) | 10 | Oui | Preuve 98 étapes | Aucune |
| 8 | Balance | pack-real-adventure-08-q041 | Expert (168) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Balance | pack-real-adventure-08-q042 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Balance | pack-real-adventure-08-q043 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Balance | pack-real-adventure-08-q044 | Expert (170) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Balance | pack-real-adventure-08-q045 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Balance | pack-real-adventure-08-q046 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Balance | pack-real-adventure-08-q047 | Expert (172) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Balance | pack-real-adventure-08-q048 | Expert (173) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Balance | pack-real-adventure-08-q049 | Expert (176) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Balance | pack-real-adventure-08-q050 | Expert (199) | 10 | Oui | Preuve 98 étapes | Aucune |
| 8 | Couronne australe | pack-real-adventure-08-q051 | Expert (168) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Couronne australe | pack-real-adventure-08-q052 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Couronne australe | pack-real-adventure-08-q053 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Couronne australe | pack-real-adventure-08-q054 | Expert (170) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Couronne australe | pack-real-adventure-08-q055 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Couronne australe | pack-real-adventure-08-q056 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Couronne australe | pack-real-adventure-08-q057 | Expert (172) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Couronne australe | pack-real-adventure-08-q058 | Expert (174) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Couronne australe | pack-real-adventure-08-q059 | Expert (176) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Couronne australe | pack-real-adventure-08-q060 | Expert (200) | 10 | Oui | Preuve 100 étapes | Aucune |
| 8 | Écu de Sobieski | pack-real-adventure-08-q061 | Expert (168) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Écu de Sobieski | pack-real-adventure-08-q062 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Écu de Sobieski | pack-real-adventure-08-q063 | Expert (169) | 9 | Oui | Preuve 79 étapes | Aucune |
| 8 | Écu de Sobieski | pack-real-adventure-08-q064 | Expert (170) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Écu de Sobieski | pack-real-adventure-08-q065 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Écu de Sobieski | pack-real-adventure-08-q066 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Écu de Sobieski | pack-real-adventure-08-q067 | Expert (172) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Écu de Sobieski | pack-real-adventure-08-q068 | Expert (174) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Écu de Sobieski | pack-real-adventure-08-q069 | Expert (176) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Écu de Sobieski | pack-real-adventure-08-q070 | Expert (201) | 10 | Oui | Preuve 98 étapes | Aucune |
| 8 | Serpent | pack-real-adventure-08-q071 | Expert (168) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Serpent | pack-real-adventure-08-q072 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Serpent | pack-real-adventure-08-q073 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Serpent | pack-real-adventure-08-q074 | Expert (170) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Serpent | pack-real-adventure-08-q075 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Serpent | pack-real-adventure-08-q076 | Expert (171) | 9 | Oui | Preuve 79 étapes | Aucune |
| 8 | Serpent | pack-real-adventure-08-q077 | Expert (172) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Serpent | pack-real-adventure-08-q078 | Expert (174) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Serpent | pack-real-adventure-08-q079 | Expert (177) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Serpent | pack-real-adventure-08-q080 | Expert (201) | 10 | Oui | Preuve 98 étapes | Aucune |
| 8 | Hydre | pack-real-adventure-08-q081 | Expert (168) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Hydre | pack-real-adventure-08-q082 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Hydre | pack-real-adventure-08-q083 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Hydre | pack-real-adventure-08-q084 | Expert (170) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Hydre | pack-real-adventure-08-q085 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Hydre | pack-real-adventure-08-q086 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Hydre | pack-real-adventure-08-q087 | Expert (173) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Hydre | pack-real-adventure-08-q088 | Expert (174) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Hydre | pack-real-adventure-08-q089 | Expert (178) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Hydre | pack-real-adventure-08-q090 | Expert (202) | 10 | Oui | Preuve 100 étapes | Aucune |
| 8 | Centaure | pack-real-adventure-08-q091 | Expert (168) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Centaure | pack-real-adventure-08-q092 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Centaure | pack-real-adventure-08-q093 | Expert (169) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Centaure | pack-real-adventure-08-q094 | Expert (170) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Centaure | pack-real-adventure-08-q095 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Centaure | pack-real-adventure-08-q096 | Expert (171) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Centaure | pack-real-adventure-08-q097 | Expert (173) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Centaure | pack-real-adventure-08-q098 | Expert (174) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Centaure | pack-real-adventure-08-q099 | Expert (178) | 9 | Oui | Preuve 81 étapes | Aucune |
| 8 | Centaure | pack-real-adventure-08-q100 | Expert (202) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Flèche | pack-real-adventure-09-q001 | Expert (202) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Flèche | pack-real-adventure-09-q002 | Expert (204) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Flèche | pack-real-adventure-09-q003 | Expert (205) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Flèche | pack-real-adventure-09-q004 | Expert (206) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Flèche | pack-real-adventure-09-q005 | Expert (207) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Flèche | pack-real-adventure-09-q006 | Expert (209) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Flèche | pack-real-adventure-09-q007 | Expert (210) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Flèche | pack-real-adventure-09-q008 | Expert (212) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Flèche | pack-real-adventure-09-q009 | Expert (212) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Flèche | pack-real-adventure-09-q010 | Expert (215) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle | pack-real-adventure-09-q011 | Expert (203) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle | pack-real-adventure-09-q012 | Expert (204) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle | pack-real-adventure-09-q013 | Expert (205) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle | pack-real-adventure-09-q014 | Expert (206) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle | pack-real-adventure-09-q015 | Expert (207) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle | pack-real-adventure-09-q016 | Expert (209) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle | pack-real-adventure-09-q017 | Expert (210) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle | pack-real-adventure-09-q018 | Expert (212) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle | pack-real-adventure-09-q019 | Expert (212) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle | pack-real-adventure-09-q020 | Expert (215) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle austral | pack-real-adventure-09-q021 | Expert (203) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle austral | pack-real-adventure-09-q022 | Expert (204) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle austral | pack-real-adventure-09-q023 | Expert (206) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle austral | pack-real-adventure-09-q024 | Expert (207) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle austral | pack-real-adventure-09-q025 | Expert (207) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle austral | pack-real-adventure-09-q026 | Expert (209) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle austral | pack-real-adventure-09-q027 | Expert (210) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle austral | pack-real-adventure-09-q028 | Expert (212) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle austral | pack-real-adventure-09-q029 | Expert (214) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Triangle austral | pack-real-adventure-09-q030 | Expert (217) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Poisson austral | pack-real-adventure-09-q031 | Expert (203) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Poisson austral | pack-real-adventure-09-q032 | Expert (204) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Poisson austral | pack-real-adventure-09-q033 | Expert (206) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Poisson austral | pack-real-adventure-09-q034 | Expert (207) | 10 | Oui | Preuve 98 étapes | Aucune |
| 9 | Poisson austral | pack-real-adventure-09-q035 | Expert (207) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Poisson austral | pack-real-adventure-09-q036 | Expert (209) | 10 | Oui | Preuve 98 étapes | Aucune |
| 9 | Poisson austral | pack-real-adventure-09-q037 | Expert (210) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Poisson austral | pack-real-adventure-09-q038 | Expert (212) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Poisson austral | pack-real-adventure-09-q039 | Expert (214) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Poisson austral | pack-real-adventure-09-q040 | Expert (217) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Caméléon | pack-real-adventure-09-q041 | Expert (203) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Caméléon | pack-real-adventure-09-q042 | Expert (205) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Caméléon | pack-real-adventure-09-q043 | Expert (206) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Caméléon | pack-real-adventure-09-q044 | Expert (207) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Caméléon | pack-real-adventure-09-q045 | Expert (208) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Caméléon | pack-real-adventure-09-q046 | Expert (209) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Caméléon | pack-real-adventure-09-q047 | Expert (210) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Caméléon | pack-real-adventure-09-q048 | Expert (212) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Caméléon | pack-real-adventure-09-q049 | Expert (214) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Caméléon | pack-real-adventure-09-q050 | Expert (217) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Table | pack-real-adventure-09-q051 | Expert (203) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Table | pack-real-adventure-09-q052 | Expert (205) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Table | pack-real-adventure-09-q053 | Expert (206) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Table | pack-real-adventure-09-q054 | Expert (207) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Table | pack-real-adventure-09-q055 | Expert (208) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Table | pack-real-adventure-09-q056 | Expert (210) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Table | pack-real-adventure-09-q057 | Expert (211) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Table | pack-real-adventure-09-q058 | Expert (212) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Table | pack-real-adventure-09-q059 | Expert (214) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Table | pack-real-adventure-09-q060 | Expert (218) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Octant | pack-real-adventure-09-q061 | Expert (203) | 10 | Oui | Preuve 98 étapes | Aucune |
| 9 | Octant | pack-real-adventure-09-q062 | Expert (205) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Octant | pack-real-adventure-09-q063 | Expert (206) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Octant | pack-real-adventure-09-q064 | Expert (207) | 10 | Oui | Preuve 98 étapes | Aucune |
| 9 | Octant | pack-real-adventure-09-q065 | Expert (208) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Octant | pack-real-adventure-09-q066 | Expert (210) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Octant | pack-real-adventure-09-q067 | Expert (211) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Octant | pack-real-adventure-09-q068 | Expert (212) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Octant | pack-real-adventure-09-q069 | Expert (214) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Octant | pack-real-adventure-09-q070 | Expert (218) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Petite Ourse | pack-real-adventure-09-q071 | Expert (204) | 10 | Oui | Preuve 98 étapes | Aucune |
| 9 | Petite Ourse | pack-real-adventure-09-q072 | Expert (205) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Petite Ourse | pack-real-adventure-09-q073 | Expert (206) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Petite Ourse | pack-real-adventure-09-q074 | Expert (207) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Petite Ourse | pack-real-adventure-09-q075 | Expert (208) | 10 | Oui | Preuve 98 étapes | Aucune |
| 9 | Petite Ourse | pack-real-adventure-09-q076 | Expert (210) | 10 | Oui | Preuve 98 étapes | Aucune |
| 9 | Petite Ourse | pack-real-adventure-09-q077 | Expert (211) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Petite Ourse | pack-real-adventure-09-q078 | Expert (212) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Petite Ourse | pack-real-adventure-09-q079 | Expert (214) | 10 | Oui | Preuve 100 étapes | Aucune |
| 9 | Petite Ourse | pack-real-adventure-09-q080 | Expert (219) | 10 | Oui | Preuve 100 étapes | Aucune |
