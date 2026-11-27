import * as T from 'three';

export function makeSkyAndOcean(scene) {
const sunDir=new T.Vector3(-.38,.15,-1).normalize();const sky=new T.Mesh(new T.SphereGeometry(550,48,24),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{sunDir:{value:sunDir},time:{value:0}},vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vDir;uniform vec3 sunDir;uniform float time;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.04+vec2(3.1,1.7);a*=.5;}return s;}void main(){vec3 d=normalize(vDir);float h=max(0.,d.y);vec3 col=mix(vec3(.82,.43,.25),vec3(.125,.24,.44),smoothstep(0.,.68,h));col=mix(col,vec3(.68,.38,.42),exp(-abs(h-.17)*9.)*.45);float sd=max(0.,dot(d,sunDir));col+=vec3(1.,.42,.13)*pow(sd,16.)*.38;col+=vec3(1.,.72,.36)*pow(sd,180.)*.9;col=mix(col,vec3(1.,.89,.62)*1.8,smoothstep(.9992,.9997,sd));vec2 uv=d.xz/(max(.07,d.y)+.22)*3.;float c=fbm(uv+vec2(time*.004,0.));float cl=smoothstep(.48,.68,c)*smoothstep(.015,.12,d.y)*(1.-smoothstep(.48,.85,d.y));col=mix(col,mix(vec3(.29,.23,.37),vec3(.99,.62,.43),smoothstep(.46,.74,c)),cl*.72);col=mix(col,vec3(.51,.43,.47),(1.-smoothstep(-.21,.01,d.y)));gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`.replace(';#include',';\n#include')}));scene.add(sky);
const water = new T.Mesh(new T.PlaneGeometry(1450,1450), new T.ShaderMaterial({
  uniforms:{time:{value:0},sunDir:{value:sunDir}},
  vertexShader:`
    varying vec3 vWorld;
    void main(){
      vWorld=(modelMatrix*vec4(position,1.)).xyz;
      gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);
    }
  `,
  fragmentShader:`
    varying vec3 vWorld;
    uniform float time;
    uniform vec3 sunDir;
    void main(){
      vec2 p=vWorld.xz;
      vec3 toEye=cameraPosition-vWorld;
      float distance=length(toEye);
      vec3 eye=toEye/distance;

      // Two broad swells bend the crests and vary their strength across the water.
      float swell=sin(dot(p,vec2(.105,.076))+time*.38);
      float crossSwell=sin(dot(p,vec2(-.143,.092))-time*.28);
      vec2 drift=vec2(1.46*swell+.53*crossSwell,.61*swell-1.19*crossSwell);
      float a=cos(dot(p+drift,vec2(.39,.72))+time*.83);
      float b=cos(dot(p-drift*.73,vec2(-.86,.51))+time*1.04);
      float c=cos(dot(p+drift.yx,vec2(1.26,.94))+time*1.38);
      float d=cos(dot(p+drift*1.22,vec2(-1.17,2.02))-time*1.52);
      float details=1.-smoothstep(24.,115.,distance);
      float waveFade=1.-smoothstep(75.,270.,distance);
      vec2 ripple=(vec2(.043,.078)*a*(.80+.20*crossSwell)
        +vec2(-.050,.029)*b*(.82+.18*swell)
        +details*(vec2(.028,.023)*c+vec2(-.025,.042)*d))*waveFade;
      vec3 normal=normalize(vec3(ripple.x,1.,ripple.y));

      // Approximate the sky in the reflected direction with its horizon and zenith colors.
      vec3 reflected=reflect(-eye,normal);
      float skyHeight=max(0.,reflected.y);
      vec3 skyTint=mix(vec3(.82,.43,.25),vec3(.125,.24,.44),smoothstep(0.,.68,skyHeight));
      skyTint=mix(skyTint,vec3(.68,.38,.42),exp(-abs(skyHeight-.17)*9.)*.45);
      float sunAlignment=max(0.,dot(reflected,sunDir));
      float grazing=1.-max(0.,dot(normal,eye));
      float reflectance=.085+.86*pow(grazing,4.);
      vec3 deepWater=vec3(.012,.081,.104)*(1.+.095*swell+.055*crossSwell);
      vec3 color=mix(deepWater,skyTint*.67,reflectance);
      color+=vec3(1.10,.50,.21)*(.61*pow(sunAlignment,82.)+.21*pow(sunAlignment,23.));

      float z=p.y,x=p.x;
      float center=sin(z*.047)*3.4;
      float edge=length(vec2((x-center)/33.,(z-28.)/78.))+
        .037*sin(z*.22+x*.12)+.018*sin(x*.36-z*.11);
      float shore=mix(.895,.939,1.-smoothstep(-25.,45.,z));
      float coast=1.-smoothstep(.005,.045,abs(edge-shore));
      float wave=sin(edge*490.-time*2.2+2.*sin(x*.52+z*.48));
      float foam=smoothstep(.58,.98,wave*.74+.26*sin(z*1.7+x*1.94+time*.65))*coast;
      color=mix(color,vec3(.054,.21,.18),coast*.46);
      color+=foam*vec3(.30,.38,.37);
      color=mix(color,vec3(.56,.42,.43),smoothstep(52.,470.,distance)*.90);
      gl_FragColor=vec4(color,1.);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }
  `
}));
water.rotation.x=-Math.PI/2;
water.position.y=-10;
scene.add(water);
return (time,camera) => {
  sky.position.copy(camera.position);
  sky.material.uniforms.time.value=time;
  water.material.uniforms.time.value=time;
};
}
