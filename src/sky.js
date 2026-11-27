import * as T from 'three';

export function makeSkyAndOcean(scene, oceanSlopes) {
oceanSlopes.wrapS=oceanSlopes.wrapT=T.RepeatWrapping;
const sunDir=new T.Vector3(-.38,.15,-1).normalize();const sky=new T.Mesh(new T.SphereGeometry(550,48,24),new T.ShaderMaterial({side:T.BackSide,depthWrite:false,uniforms:{sunDir:{value:sunDir},time:{value:0}},vertexShader:`varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vDir;uniform vec3 sunDir;uniform float time;float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.04+vec2(3.1,1.7);a*=.5;}return s;}void main(){vec3 d=normalize(vDir);float h=max(0.,d.y);vec3 col=mix(vec3(.82,.43,.25),vec3(.125,.24,.44),smoothstep(0.,.68,h));col=mix(col,vec3(.68,.38,.42),exp(-abs(h-.17)*9.)*.45);float sd=max(0.,dot(d,sunDir));col+=vec3(1.,.42,.13)*pow(sd,16.)*.38;col+=vec3(1.,.72,.36)*pow(sd,180.)*.9;col=mix(col,vec3(1.,.89,.62)*1.8,smoothstep(.9992,.9997,sd));vec2 uv=d.xz/(max(.07,d.y)+.22)*3.;float c=fbm(uv+vec2(time*.004,0.));float cl=smoothstep(.48,.68,c)*smoothstep(.015,.12,d.y)*(1.-smoothstep(.48,.85,d.y));col=mix(col,mix(vec3(.29,.23,.37),vec3(.99,.62,.43),smoothstep(.46,.74,c)),cl*.72);col=mix(col,vec3(.51,.43,.47),(1.-smoothstep(-.21,.01,d.y)));gl_FragColor=vec4(col,1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`.replace(';#include',';\n#include')}));scene.add(sky);
const water = new T.Mesh(new T.PlaneGeometry(1450,1450), new T.ShaderMaterial({
  uniforms:{time:{value:0},sunDir:{value:sunDir},oceanSlopes:{value:oceanSlopes}},
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
    uniform sampler2D oceanSlopes;
    void main(){
      vec2 p=vWorld.xz;
      vec3 toEye=cameraPosition-vWorld;
      float distance=length(toEye);
      vec3 eye=toEye/distance;

      // Red and green store signed slopes; blue varies the chop across the swell.
      // The same seamless spectral texture moves at two scales and directions.
      mat2 turn=mat2(.6,.8,-.8,.6);
      vec3 swell=texture2D(oceanSlopes,p*.0071+vec2(.012,-.007)*time).rgb;
      vec2 wideSlope=swell.rg*2.-1.;
      vec3 chop=texture2D(oceanSlopes,turn*p*.027+wideSlope*.12+vec2(-.018,.013)*time).rgb;
      vec2 fineSlope=mat2(.6,-.8,.8,.6)*(chop.rg*2.-1.);
      float details=1.-smoothstep(28.,150.,distance);
      float waveFade=1.-smoothstep(95.,315.,distance);
      vec2 ripple=(wideSlope*.21+fineSlope*(.12+.12*swell.b)*details)*waveFade;
      vec3 normal=normalize(vec3(ripple.x,1.,ripple.y));

      // Approximate the sky in the reflected direction with its horizon and zenith colors.
      vec3 reflected=reflect(-eye,normal);
      float skyHeight=max(0.,reflected.y);
      vec3 skyTint=mix(vec3(.82,.43,.25),vec3(.125,.24,.44),smoothstep(0.,.68,skyHeight));
      skyTint=mix(skyTint,vec3(.68,.38,.42),exp(-abs(skyHeight-.17)*9.)*.45);
      float sunAlignment=max(0.,dot(reflected,sunDir));
      float grazing=1.-max(0.,dot(normal,eye));
      float reflectance=.085+.86*pow(grazing,4.);
      vec3 deepWater=vec3(.012,.081,.104)*(.90+.20*swell.b);
      vec3 color=mix(deepWater,skyTint*.67,reflectance);
      color+=vec3(1.10,.50,.21)*(.63*pow(sunAlignment,92.)+.14*pow(sunAlignment,23.));

      float z=p.y,x=p.x;
      float center=sin(z*.047)*3.4;
      float coastWidth=33.+380.*smoothstep(-28.,115.,z);
      float edge=length(vec2((x-center)/coastWidth,max(28.-z,0.)/78.))+
        .037*sin(z*.22+x*.12)+.018*sin(x*.36-z*.11);
      float shore=mix(.895,.939,1.-smoothstep(-25.,45.,z));
      float coast=1.-smoothstep(.005,.045,abs(edge-shore));
      float wave=sin(edge*490.-time*2.2+5.*swell.b+2.*chop.b);
      float foam=smoothstep(.57,.95,wave*.68+chop.b-.5)*coast*smoothstep(.22,.65,swell.b);
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
