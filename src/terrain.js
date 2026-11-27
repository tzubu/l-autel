import * as T from 'three';

const {lerp, smoothstep, clamp} = T.MathUtils;
const smooth = (a, b, x) => smoothstep(x, a, b);
export const seaLevel = -10;
export const altarZ = -22.3;
export const pathX = z => 1.55 * Math.sin(z * .12) + .55 * Math.sin(z * .25);
export const altarX = pathX(altarZ);

// The headland widens inland, with its wooded hills continuing behind the path.
function profile(x, z) {
  const center = Math.sin(z * .047) * 3.4;
  const sideExtension = 26 * smooth(-31, -4, z) * (1 - smooth(60, 140, z));
  const width = 33 + 380 * smooth(-28, 115, z) + sideExtension;
  const edge = Math.hypot((x - center) / width, Math.max(28 - z, 0) / 78)
    + .037 * Math.sin(z * .22 + x * .12)
    + .018 * Math.sin(x * .36 - z * .11);
  const coast = 1 - smooth(.64, 1.02, edge);
  const inland = smooth(27, 138, z);
  const hill = 1.8 + 5.7 * (1 - smooth(-23, 24, z))
    + 1.2 * Math.exp(-((z - 55) ** 2) / 600)
    + inland * (13.0 + 4.5 * Math.sin(x * .024 + z * .021)
      + 3.4 * Math.cos(z * .045 - x * .031));
  const offPath = smooth(2, 6, Math.abs(x - pathX(z)));
  const clearing = smooth(3.5, 8, Math.hypot(x - altarX, z - altarZ));
  const nearRelief = 1 - smooth(45, 105, Math.max(Math.abs(x), z));
  const relief = offPath * clearing * nearRelief * (
    .52 * Math.sin(x * .32 + z * .18) + .32 * Math.cos(z * .35 - x * .21)
    + .14 * Math.sin(x * .71 - z * .42));
  const floor = -15 + 1.7 * Math.exp(-((edge - 1.035) ** 2) * 90);
  const terrace=1-smooth(2.75,5.8,Math.hypot(x-altarX,z-altarZ));
  return lerp(lerp(floor, hill + relief, coast),7.44,terrace);
}

// Extend the fine grid with progressively larger cells outside the playing area.
function extendAxis(axis, direction, boundary) {
  const outer = [];
  let edge = direction < 0 ? axis[0] : axis[axis.length-1], stride = .70;
  while (direction * edge < direction * boundary) {
    stride = Math.min(14, stride * 1.17);
    edge += direction * stride;
    outer.push(edge);
  }
  return direction < 0 ? outer.reverse().concat(axis) : axis.concat(outer);
}

const columns = extendAxis(extendAxis(Array.from({length:105},(_,i)=>-36+i*.70), -1, -465), 1, 465);
const rows = extendAxis(Array.from({length:164},(_,i)=>-59+i*.70), 1, 655);
const cellsX = columns.length - 1, cellsZ = rows.length - 1;
const heights = new Float32Array((cellsX + 1) * (cellsZ + 1));
const index = (x, z) => z * (cellsX + 1) + x;
for (let z = 0; z <= cellsZ; z++) {
  for (let x = 0; x <= cellsX; x++) {
    heights[index(x, z)] = profile(columns[x], rows[z]);
  }
}

// Barycentric sampling uses the same triangles as the rendered ground.
function cell(axis, value) {
  let a=0, b=axis.length-1;
  while (b-a>1) {
    const middle=(a+b)>>1;
    if (axis[middle]<=value) a=middle;
    else b=middle;
  }
  return a;
}

export function ground(x, z) {
  const i=cell(columns,x), j=cell(rows,z);
  const a=clamp((x-columns[i])/(columns[i+1]-columns[i]),0,1);
  const b=clamp((z-rows[j])/(rows[j+1]-rows[j]),0,1);
  const h00 = heights[index(i, j)], h10 = heights[index(i + 1, j)];
  const h01 = heights[index(i, j + 1)], h11 = heights[index(i + 1, j + 1)];
  return a + b <= 1
    ? h00 * (1 - a - b) + h10 * a + h01 * b
    : h11 * (a + b - 1) + h10 * (1 - b) + h01 * (1 - a);
}

function trail(x, z) {
  const waviness = .16 * Math.sin(z * 1.35) + .13 * Math.sin(x * 2.3 - z * .3);
  const lane = (1 - smooth(1.05, 2.65, Math.abs(x - pathX(z)) + waviness))
    * smooth(-30, -24, z) * (1 - smooth(44, 65, z));
  const clearing = 1 - smooth(2.2, 4.4, Math.hypot((x - altarX) * .79, z - altarZ));
  return Math.max(lane, clearing * .94);
}

export function makeTerrain(scene, grassColor, grassNormal, meadowColor) {
  const pos = [], uv = [], mask = [], indices = [];
  for (let j = 0; j <= cellsZ; j++) {
    for (let i = 0; i <= cellsX; i++) {
      const x = columns[i], z = rows[j], y = heights[index(i, j)];
      const grade = Math.hypot(ground(x + .3, z) - ground(x - .3, z),
        ground(x, z + .3) - ground(x, z - .3)) / .6;
      pos.push(x, y, z);
      uv.push(x / 2.5, -z / 2.5);
      mask.push(trail(x, z), smooth(.64, 1.42, grade) * smooth(-8.8, -5.8, y),
        1 - smooth(-8.8, -5.9, y));
      if (i < cellsX && j < cellsZ) {
        const a = index(i, j), b = index(i, j + 1);
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setAttribute('surface', new T.Float32BufferAttribute(mask, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const material = new T.MeshStandardMaterial({
    map: grassColor, normalMap: grassNormal, normalScale: new T.Vector2(.66, .66), roughness: 1
  });
  material.onBeforeCompile = s => {
    s.uniforms.meadowMap = {value: meadowColor};
    s.vertexShader = 'attribute vec3 surface; varying vec3 vSurface;\n' + s.vertexShader;
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>',
      '#include <begin_vertex>\nvSurface = surface;');
    s.fragmentShader = 'varying vec3 vSurface; uniform sampler2D meadowMap;\n' + s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace('#include <map_fragment>', `
      vec2 p = vMapUv;
      vec3 wild = texture2D(map, p).rgb;
      vec3 meadow = texture2D(meadowMap, p * 1.45 + vec2(.12,.51)).rgb;
      float patches = smoothstep(.12,.85,.53 + .25*sin(p.x*.83+p.y*.67) + .22*cos(p.y*1.75-p.x*.21));
      vec3 grass = mix(wild * vec3(.86,1.03,.64), meadow * vec3(.78,.87,.54), .36+.46*patches);
      float grain = clamp(dot(wild, vec3(.29,.58,.13))*2.0,0.,1.);
      vec3 dirt = mix(vec3(.115,.071,.038), vec3(.46,.312,.155), grain);
      vec3 rock = mix(vec3(.064,.073,.072), vec3(.29,.263,.218), grain);
      vec3 sand = mix(vec3(.19,.145,.092), vec3(.54,.435,.29), grain);
      diffuseColor.rgb *= mix(mix(mix(grass,dirt,vSurface.x),rock,vSurface.y),sand,vSurface.z);
    `);
  };
  const terrain = new T.Mesh(geometry, material);
  terrain.receiveShadow = true;
  scene.add(terrain);
}

export function makeMeadow(scene, rnd, wind) {
  const pos = [], colors = [], indices = [];
  const base = new T.Color('#465a34'), tip = new T.Color('#a2af62');
  for (let i = 0; i < 8; i++) {
    const angle = rnd() * Math.PI * 2, ux = Math.cos(angle), uz = Math.sin(angle);
    const x = (rnd() - .5) * .34, z = (rnd() - .5) * .34;
    const height = .17 + rnd() * .32, width = .009 + rnd() * .018, bend = .08 + rnd() * .19;
    const first = pos.length / 3;
    for (let j = 0; j < 4; j++) {
      const t = j / 3, w = width * (1 - t * .86);
      for (const side of [-1, 1]) {
        pos.push(x + ux * side * w - uz * t * t * bend, t * height,
          z + uz * side * w + ux * t * t * bend);
        const color = base.clone().lerp(tip, t).multiplyScalar(.83 + i * .055);
        colors.push(color.r, color.g, color.b);
      }
      if (j < 3) {
        const a = first + j * 2;
        indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new T.MeshStandardMaterial({vertexColors:true, side:T.DoubleSide, roughness:1});
  mat.onBeforeCompile = shader => {
    shader.uniforms.windTime = wind;
    shader.vertexShader = 'uniform float windTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      vec2 windPos = instanceMatrix[3].xz;
      float gust = sin(windTime*1.45 + dot(windPos, vec2(.38,.31)))
                 + .35*sin(windTime*3.1 + dot(windPos,vec2(-.61,.49)));
      vec3 push = vec3(.58,0.,.27);
      vec3 localWind = transpose(mat3(instanceMatrix)) * push;
      transformed += localWind * position.y * position.y * gust;
    `);
  };
  const dummy = new T.Object3D(), tint = new T.Color(), tiles=[];
  for (let oz = -40; oz < 96; oz += 16) {
    for (let ox = -35; ox < 35; ox += 14) {
      const tuft = new T.InstancedMesh(geo, mat, 480);
      let n = 0;
      for (let i = 0; i < 480; i++) {
        const x = ox + rnd() * 14, z = oz + rnd() * 16, y = ground(x, z);
        if (y < -5.1 || trail(x,z) > rnd() * .85 + .13) continue;
        if (Math.abs(ground(x+.4,z)-ground(x-.4,z)) > .8 ||
            Math.abs(ground(x,z+.4)-ground(x,z-.4)) > .8) continue;
        const size = .38 + rnd() * .71;
        dummy.position.set(x, y - .035, z);
        dummy.rotation.y = rnd() * 6.283;
        dummy.scale.set(size, size * (.75 + rnd() * .45), size);
        dummy.updateMatrix();
        tuft.setMatrixAt(n, dummy.matrix);
        tint.setRGB(.68 + rnd() * .30, .72 + rnd() * .28, .46 + rnd() * .45);
        tuft.setColorAt(n++, tint);
      }
      if (!n) continue;
      tuft.count = n;
      tuft.computeBoundingSphere();
      tuft.receiveShadow = true;
      scene.add(tuft);
      tiles.push({tuft,x:ox+7,z:oz+8});
    }
  }
  return camera => {
    for (const {tuft,x,z} of tiles) {
      tuft.visible=(x-camera.position.x)**2+(z-camera.position.z)**2<48**2;
    }
  };
}
