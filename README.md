# L'autel

[Jouer en ligne](https://tzubu.github.io/l-autel/)

## Jouer

Ouvrir le fichier `L'autel.html` dans un navigateur de bureau compatible WebGL. Le fichier contient les modèles, les textures, le poème et le moteur. Il fonctionne hors ligne et s’ouvre directement par double-clic.

- Cliquer sur « Commencer » pour entrer dans le jeu et contrôler la caméra à la souris.
- Marcher avec ZQSD ou les flèches et sauter avec Espace.
- Près de l’autel, appuyer sur E ou cliquer sur « E pour s’asseoir à l’autel ». Pouet joint les mains, puis le formulaire apparaît. « Prier » lance la fin de la scène. Échap libère la souris ou ferme le formulaire.

Le texte de la prière est effacé au clic sur « Prier ». Il reste en mémoire pendant la saisie.

## Modifier le jeu

Ce dossier contient le code et les ressources d’exécution. Les modèles importés sont au format GLB dans `src/assets/`.

Pour reconstruire le fichier HTML depuis les sources, ouvrir un terminal dans le dossier, puis exécuter les deux commandes suivantes avec Node.js installé.

```sh
npm ci
npm run build
```

Pour reconstruire la version GitHub Pages, exécuter `npm run build -- --web`. Elle utilise `docs/index.html` et charge les ressources séparément.

## Crédits

- Autel, Pouet et poème issus du prototype fourni.
- [Grass Ground](https://polyhaven.com/a/grass_ground) par Charlotte Baglioni et Poly Haven, CC0 1.0. Couleur et normales adaptées au terrain.
- [Grass 004](https://ambientcg.com/view?id=Grass004) par ambientCG, CC0 1.0. Couleur combinée à celle du terrain.
- [Rock Moss Set 01](https://polyhaven.com/a/rock_moss_set_01) par Kless Gyzen et Poly Haven, CC0 1.0. Géométrie allégée pour le jeu.
- [Pine Trees Pack Lowpoly Game Ready LODs](https://sketchfab.com/3d-models/pine-trees-pack-lowpoly-game-ready-lods-e1e9c07b8e2e445c943fec660beefba2) par LOLIPOP, Creative Commons Attribution. Modèles du prototype optimisés et replacés sur le terrain.
- Three.js 0.160.1, licence MIT incluse dans `LICENSE-Three.txt` et dans le HTML.
