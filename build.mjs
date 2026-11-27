import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const [html,css,result,license]=await Promise.all([
  readFile(new URL('./src/index.html',import.meta.url),'utf8'),
  readFile(new URL('./src/style.css',import.meta.url),'utf8'),
  build({
    entryPoints:[fileURLToPath(new URL('./src/game.js',import.meta.url))],
    bundle:true,format:'iife',target:'es2021',write:false,minify:true,
    loader:{'.glb':'dataurl','.jpg':'dataurl','.txt':'text'}
  }),
  readFile(new URL('./node_modules/three/LICENSE',import.meta.url),'utf8')
]);
const bundle=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const attribution=`\n<!--
Three.js
${license.trim()}

Grass Ground — Charlotte Baglioni, Poly Haven, CC0 1.0
https://polyhaven.com/a/grass_ground
Grass 004 — ambientCG, CC0 1.0
https://ambientcg.com/view?id=Grass004
Rock Moss Set 01 — Kless Gyzen, Poly Haven, CC0 1.0
https://polyhaven.com/a/rock_moss_set_01
Pine Trees Pack Lowpoly Game Ready LODs — LOLIPOP, Sketchfab, CC Attribution
https://sketchfab.com/3d-models/pine-trees-pack-lowpoly-game-ready-lods-e1e9c07b8e2e445c943fec660beefba2
Pins repris du prototype avec placement et rendu ajustés.
-->\n`;
const output=html.replace('/* game styles */',()=>css)
  .replace('/* game bundle */',()=>bundle)
  .replace('</body>',()=>attribution+'</body>');
await writeFile(process.argv[2] ?? "L'autel.html",output);
