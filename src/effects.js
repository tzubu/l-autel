import * as T from 'three';

const v = () => new T.Vector3();
const billboard = `
  varying vec2 vUv;
  void main(){
    vUv=uv;
    vec3 center=(modelViewMatrix*vec4(0.,0.,0.,1.)).xyz;
    vec2 size=vec2(length(modelMatrix[0].xyz),length(modelMatrix[1].xyz));
    gl_Position=projectionMatrix*vec4(center+vec3(position.xy*size,0.),1.);
  }
`;
const output = `
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
`;
const flame = `
  uniform float time, phase;
  varying vec2 vUv;
  void main(){
    float h=vUv.y;
    float lean=sin(time*4.7+phase)*.073*h*h+sin(time*12.2+phase)*.02*h*h;
    float x=abs(vUv.x-.5-lean-.09*h*h);
    float width=.31*pow(max(0.,sin(pow(h,.67)*3.14159)),.88)*(1.-h*.68)+.003;
    float edge=(1.-smoothstep(width*.66,width*1.13,x))
      *smoothstep(0.,.12,h)*(1.-smoothstep(.71,.98,h));
    float core=(1.-smoothstep(width*.24,width*.78,x))
      *smoothstep(.13,.29,h)*(1.-smoothstep(.53,.88,h));
    vec3 color=mix(vec3(1.9,.24,.025),vec3(2.1,1.42,.48),core);
    color=mix(vec3(.30,.54,1.55),color,smoothstep(.04,.24,h));
    gl_FragColor=vec4(color,edge);
    ${output}
  }
`;
const glow = `
  uniform float strength;
  varying vec2 vUv;
  void main(){
    float d=length(vUv-.5)*2.;
    float halo=exp(-d*d*7.8)*(1.-smoothstep(.67,1.,d));
    gl_FragColor=vec4(1.,.48,.14,halo*strength);
    ${output}
  }
`;
const smokeVertex = `
  varying vec2 vUv;
  void main(){
    vUv=uv;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  }
`;
const smokeFragment = `
  uniform float time, phase;
  varying vec2 vUv;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float noise(vec2 p){
    vec2 i=floor(p), f=fract(p);
    f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),
      mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
  }
  void main(){
    float h=vUv.y, s=vUv.x*2.-1.;
    vec2 p=vec2(vUv.x*3.6,h*11.-time*.93+phase);
    float flow=noise(p+vec2(0.,noise(p*.64)*1.5));
    float fine=noise(p*2.1+vec2(time*.11,-time*.38));
    float curl=sin(h*27.-time*1.5+phase+flow*2.4)*.34*smoothstep(.12,.69,h);
    float center=s-curl;
    float ribbon=exp(-center*center*(6.1+fine*6.));
    float fold=exp(-pow((center+.28*sin(h*33.-time*2.+phase))*4.4,2.))*.31;
    float edge=1.-smoothstep(.54,.98,abs(s));
    float fade=smoothstep(0.,.028,h)*(1.-smoothstep(.27,1.,h));
    float breakup=smoothstep(.13,.72,flow*.67+fine*.33);
    float alpha=edge*fade*(ribbon+fold)*mix(.37,breakup*.54,smoothstep(.05,.39,h));
    vec3 color=mix(vec3(.46,.55,.60),vec3(.99,.96,.83),fine*.42+(.51-abs(center)*.48));
    gl_FragColor=vec4(color,alpha);
    ${output}
  }
`;

export function makeAltarEffects(scene, altar, altarX, altarZ, y) {
  const plane = new T.PlaneGeometry(1,1), flames=[], trails=[];
  const wickGeometry = new T.CylinderGeometry(.004,.005,.017,6);
  const wickMaterial = new T.MeshStandardMaterial({color:0x362411,roughness:1});
  const lights = [-1,1].map(side=>{
    const light=new T.PointLight(0xffa55a,.84,2.5,2);
    light.position.set(altarX+side*.58,y+1.145,altarZ+.12);
    scene.add(light);
    return light;
  });
  altar.updateMatrixWorld(true);

  for (let i = 0; i < 8; i++) {
    const candle = altar.getObjectByName(i ? 'Cylinder00'+i : 'Cylinder');
    if (!candle) continue;
    const box = new T.Box3().setFromObject(candle,true);
    const base = box.getCenter(v()).setY(box.max.y);
    const wick = new T.Mesh(wickGeometry,wickMaterial);
    wick.position.copy(base).y += .008;
    scene.add(wick);
    const phase = i * 3.713;
    const fire = new T.Mesh(plane, new T.ShaderMaterial({
      vertexShader:billboard, fragmentShader:flame, transparent:true, depthWrite:false,
      uniforms:{time:{value:0},phase:{value:phase}}
    }));
    const halo = new T.Mesh(plane, new T.ShaderMaterial({
      vertexShader:billboard, fragmentShader:glow, transparent:true, depthWrite:false,
      blending:T.AdditiveBlending, uniforms:{strength:{value:.2}}
    }));
    halo.scale.set(.36,.40,1);
    scene.add(halo,fire);
    flames.push({base,fire,halo,phase});
  }

  for (const [i,name] of ['Cylinder009','Cylinder010','Cylinder011'].entries()) {
    const stick = altar.getObjectByName(name);
    if (!stick) continue;
    const bounds = new T.Box3().setFromObject(stick,true);
    const origin=v();
    const tip = v();
    let tipSamples=0;
    stick.traverse(object => {
      if (!object.isMesh) return;
      const material=object.material.clone();
      material.onBeforeCompile=shader=>{
        shader.vertexShader='varying vec3 vStick;\n'+shader.vertexShader;
        shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\nvStick=position;');
        shader.fragmentShader='varying vec3 vStick;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>', `
          #include <color_fragment>
          float charGrain=fract(sin(dot(floor(vStick*vec3(17.,155.,17.)),
            vec3(28.42,79.7,23.14)))*43758.5);
          float ash=(1.-smoothstep(-.982,-.907,vStick.y+charGrain*.025));
          float ember=(1.-smoothstep(.008,.021,abs(vStick.y+.963)))*
            smoothstep(.37,.82,charGrain);
          diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.035,.027,.024),ash*.92);
        `).replace('#include <emissivemap_fragment>', `
          #include <emissivemap_fragment>
          totalEmissiveRadiance+=vec3(.32,.030,.005)*ember;
        `);
      };
      object.material=material;
      const vertices = object.geometry.attributes.position;
      for (let j=0; j<vertices.count; j++) {
        object.localToWorld(tip.fromBufferAttribute(vertices,j));
        if(tip.y<bounds.max.y-.002) continue;
        origin.add(tip);
        tipSamples++;
      }
    });
    if(tipSamples) origin.multiplyScalar(1/tipSamples);
    else bounds.getCenter(origin);
    origin.y=bounds.max.y;
    const geometry = new T.PlaneGeometry(1,1,1,42);
    const plume = new T.Mesh(geometry,new T.ShaderMaterial({
      vertexShader:smokeVertex,fragmentShader:smokeFragment,transparent:true,
      depthWrite:false,side:T.DoubleSide,forceSinglePass:true,
      uniforms:{time:{value:0},phase:{value:i*2.14}}
    }));
    plume.frustumCulled=false;
    scene.add(plume);
    trails.push({plume,origin,phase:i*1.48});
  }

  const horizontal = v(), center=v();
  return (time, camera) => {
    lights.forEach((light,i)=>{ light.intensity=.82+.09*Math.sin(time*6.4+i*2)+.065*Math.sin(time*12.9+i); });
    for (const {base,fire,halo,phase} of flames) {
      const h=.092+.018*Math.sin(time*10+phase)+.011*Math.sin(time*16.7+phase);
      fire.scale.set(.082,h,1);
      fire.position.copy(base).y += .015+h*.47;
      fire.material.uniforms.time.value=time;
      halo.position.copy(base).y += .067;
      halo.material.uniforms.strength.value=.25+(h-.11)*2;
    }
    for (const {plume,origin,phase} of trails) {
      horizontal.set(camera.position.z-origin.z,0,origin.x-camera.position.x).normalize();
      const {position,uv}=plume.geometry.attributes;
      for (let i=0; i<position.count; i+=2) {
        const h=uv.getY(i);
        const scatter=h**1.55;
        center.copy(origin);
        center.x+=scatter*(.24+.32*Math.sin(h*11-time*1.13+phase))+.046*h*Math.sin(h*29-time*2.4+phase);
        center.z+=scatter*(.09+.24*Math.cos(h*9-time*.86+phase));
        center.y+=h*(1.50+phase*.14)+.033*h*Math.sin(h*17-time*1.5+phase);
        const width=.012+.32*h**1.51+.07*h*Math.sin(h*13-time*1.78+phase);
        position.setXYZ(i,center.x-horizontal.x*width,center.y,center.z-horizontal.z*width);
        position.setXYZ(i+1,center.x+horizontal.x*width,center.y,center.z+horizontal.z*width);
      }
      position.needsUpdate=true;
      plume.material.uniforms.time.value=time;
    }
  };
}

export function contactShadow(scene,ground,x,z,width,depth,opacity){
  const texture=new T.CanvasTexture(document.createElement('canvas'));
  texture.image.width=texture.image.height=64;
  const ctx=texture.image.getContext('2d');
  const fade=ctx.createRadialGradient(32,32,2,32,32,32);
  fade.addColorStop(0,'#161410');
  fade.addColorStop(.45,'#161410b0');
  fade.addColorStop(1,'#16141000');
  ctx.fillStyle=fade;
  ctx.fillRect(0,0,64,64);
  const geometry=new T.PlaneGeometry(width,depth,10,10).rotateX(-Math.PI/2);
  const p=geometry.attributes.position;
  for(let i=0;i<p.count;i++){
    p.setY(i,ground(x+p.getX(i),z+p.getZ(i))+.016);
  }
  const shadow=new T.Mesh(geometry,new T.MeshBasicMaterial({
    map:texture,transparent:true,opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1
  }));
  shadow.position.set(x,0,z);
  scene.add(shadow);
  return shadow;
}
