function generateEarthTexture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  function hash(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }

  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx * fx * (3 - 2 * fx);
    const uy = fy * fy * (3 - 2 * fy);
    const a = hash(ix, iy), b = hash(ix+1, iy);
    const c = hash(ix, iy+1), d = hash(ix+1, iy+1);
    return a*(1-ux)*(1-uy) + b*ux*(1-uy) + c*(1-ux)*uy + d*ux*uy;
  }

  function fbm(x, y, oct) {
    let v = 0, amp = 0.5;
    for (let i = 0; i < (oct||6); i++) {
      v += amp * noise(x, y);
      x *= 2.1; y *= 2.1; amp *= 0.5;
    }
    return v;
  }

  function lerp(a, b, t) {
    t = Math.max(0, Math.min(1, t));
    return [
      a[0] + (b[0]-a[0])*t,
      a[1] + (b[1]-a[1])*t,
      a[2] + (b[2]-a[2])*t
    ];
  }

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let py = 0; py < height; py++) {
    const v = py / height;
    const lat = Math.abs(v - 0.5) * 2.0;

    for (let px = 0; px < width; px++) {
      const u = px / width;

      const h = fbm(u*2.8, v*2.8) + fbm(u*6.0+1.3, v*6.0+2.1)*0.35 - 0.42;
      const m = fbm(u*3.1+5.0, v*3.1+3.0);

      const DEEP_OCEAN    = [5,  20,  80];
      const MID_OCEAN     = [10, 50, 130];
      const COAST_OCEAN   = [25, 80, 150];
      const FOREST        = [15, 62, 15];
      const GRASSLAND     = [38, 92, 23];
      const SAVANNA       = [97, 92, 28];
      const DESERT        = [133,102, 41];
      const MOUNTAIN      = [71,  62, 51];
      const SNOW          = [230,237,242];
      const ICE           = [210,225,235];

      let c;
      if (h < 0.0) {
        const depth = Math.min(1.0, -h * 3.5);
        c = lerp(lerp(COAST_OCEAN, MID_OCEAN, depth), DEEP_OCEAN, depth * 0.7);
      } else if (lat > 0.85) {
        c = lerp(MOUNTAIN, ICE, Math.min(1.0, (lat - 0.85) * 6.0));
      } else if (h > 0.80) {
        c = SNOW;
      } else if (h > 0.60) {
        c = lerp(MOUNTAIN, SNOW, (h - 0.60) * 2.5);
      } else if (m > 0.55) {
        c = lerp(GRASSLAND, FOREST, Math.min(1.0, (m - 0.55) * 4.0));
      } else if (m > 0.35) {
        c = lerp(SAVANNA, GRASSLAND, (m - 0.35) * 5.0);
      } else {
        c = lerp(DESERT, SAVANNA, m * 3.0);
      }

      const idx = (py * width + px) * 4;
      data[idx]   = c[0];
      data[idx+1] = c[1];
      data[idx+2] = c[2];
      data[idx+3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

function generateNightTexture(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

  function hash(x, y) {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  }
  function noise(x, y) {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const ux = fx*fx*(3-2*fx), uy = fy*fy*(3-2*fy);
    return hash(ix,iy)*(1-ux)*(1-uy)+hash(ix+1,iy)*ux*(1-uy)+hash(ix,iy+1)*(1-ux)*uy+hash(ix+1,iy+1)*ux*uy;
  }
  function fbm(x,y){let v=0,a=0.5;for(let i=0;i<6;i++){v+=a*noise(x,y);x*=2.1;y*=2.1;a*=0.5;}return v;}

  const imgData = ctx.createImageData(width, height);
  const data = imgData.data;

  for (let py = 0; py < height; py++) {
    const v = py / height;
    for (let px = 0; px < width; px++) {
      const u = px / width;
      const h = fbm(u*2.8, v*2.8) + fbm(u*6.0+1.3, v*6.0+2.1)*0.35 - 0.42;
      const idx = (py * width + px) * 4;
      if (h >= 0.0) {
        const cityDensity = fbm(u*12.0+2.0, v*12.0+1.0);
        if (cityDensity > 0.62) {
          const bright = Math.min(255, (cityDensity - 0.62) * 600);
          data[idx]   = bright;
          data[idx+1] = Math.round(bright * 0.85);
          data[idx+2] = Math.round(bright * 0.5);
          data[idx+3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas;
}

class Earth {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.earthMesh = null;
    this.cloudMesh = null;
    this.atmosphereMesh = null;
    this.glowMesh = null;
    this.radius = 5;
    this.onReady = null;
    this.sunDirection = new THREE.Vector3(5, 1, 3).normalize();
    this.init();
  }

  init() {
    this.createAtmosphere();
    this.createOuterGlow();

    if (window.updateLoader) window.updateLoader(20);

    setTimeout(() => {
      const dayCanvas   = generateEarthTexture(512, 256);
      if (window.updateLoader) window.updateLoader(60);

      const nightCanvas = generateNightTexture(512, 256);
      if (window.updateLoader) window.updateLoader(85);

      const dayTex   = new THREE.CanvasTexture(dayCanvas);
      const nightTex = new THREE.CanvasTexture(nightCanvas);

      this.buildEarth(dayTex, nightTex);
      this.createClouds();

      if (window.updateLoader) window.updateLoader(100);
      setTimeout(() => { if (this.onReady) this.onReady(); }, 100);
    }, 50);
  }

  buildEarth(dayTex, nightTex) {
    const geometry = new THREE.SphereGeometry(this.radius, 96, 96);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture:   { value: dayTex },
        nightTexture: { value: nightTex },
        sunDirection: { value: this.sunDirection.clone() },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform vec3 sunDirection;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;

        void main() {
          vec3 normal = normalize(vNormal);
          vec3 sun = normalize(sunDirection);
          float sunDot = dot(normal, sun);
          float dayNight = smoothstep(-0.2, 0.3, sunDot);

          vec3 day   = texture2D(dayTexture,   vUv).rgb;
          vec3 night = texture2D(nightTexture, vUv).rgb * 2.5;

          float diffuse = max(0.0, sunDot);
          vec3 dayLit = day * (0.08 + diffuse * 1.1);

          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec3 halfVec = normalize(sun + viewDir);
          float spec = pow(max(dot(normal, halfVec), 0.0), 60.0) * 0.4 * dayNight;
          dayLit += vec3(spec * 0.6, spec * 0.8, spec);

          vec3 color = mix(night, dayLit, dayNight);
          color = pow(max(color, vec3(0.0)), vec3(0.9));
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });

    this.earthMesh = new THREE.Mesh(geometry, material);
    this.group.add(this.earthMesh);
  }

  createClouds() {
    const geometry = new THREE.SphereGeometry(this.radius + 0.06, 48, 48);
    const material = new THREE.ShaderMaterial({
      uniforms: { time: { value: 0.0 } },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        varying vec2 vUv;
        varying vec3 vNormal;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
        float fbm(vec2 p){float v=0.0,a=0.5;for(int i=0;i<6;i++){v+=a*noise(p);p*=2.0;a*=0.5;}return v;}
        void main() {
          vec2 uv = vUv + vec2(time * 0.004, 0.0);
          float cloud = fbm(uv*3.5) * fbm(uv*1.8+vec2(3.2,7.1));
          cloud = smoothstep(0.22, 0.55, cloud);
          vec3 viewDir = normalize(cameraPosition - vec3(0.0));
          float edge = dot(normalize(vNormal), viewDir);
          gl_FragColor = vec4(1.0, 1.0, 1.0, cloud * 0.28 * smoothstep(0.0, 0.3, edge));
        }
      `,
      transparent: true, depthWrite: false, blending: THREE.NormalBlending
    });
    this.cloudMesh = new THREE.Mesh(geometry, material);
    this.group.add(this.cloudMesh);
  }

  createAtmosphere() {
    const geometry = new THREE.SphereGeometry(this.radius + 0.18, 64, 64);
    const material = new THREE.ShaderMaterial({
      uniforms: { sunDirection: { value: this.sunDirection.clone() } },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vWorldPos = (modelMatrix * vec4(position,1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sunDirection;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float rim = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.8);
          float sf = dot(vNormal, normalize(sunDirection)) * 0.5 + 0.5;
          vec3 col = mix(vec3(0.02,0.06,0.2), vec3(0.2,0.55,1.0), sf);
          gl_FragColor = vec4(col, rim * 0.7);
        }
      `,
      transparent: true, depthWrite: false,
      side: THREE.FrontSide, blending: THREE.AdditiveBlending
    });
    this.atmosphereMesh = new THREE.Mesh(geometry, material);
    this.group.add(this.atmosphereMesh);
  }

  createOuterGlow() {
    const geometry = new THREE.SphereGeometry(this.radius + 0.8, 32, 32);
    const material = new THREE.ShaderMaterial({
      vertexShader: `
        varying vec3 vNormal;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float rim = pow(1.0 - max(dot(normalize(cameraPosition), vNormal), 0.0), 4.5) * 0.35;
          gl_FragColor = vec4(0.08, 0.35, 1.0, rim);
        }
      `,
      transparent: true, depthWrite: false,
      side: THREE.BackSide, blending: THREE.AdditiveBlending
    });
    this.glowMesh = new THREE.Mesh(geometry, material);
    this.group.add(this.glowMesh);
  }

  latLngToVec3(lat, lng, altRadius) {
    const phi   = (90 - lat)  * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    const r = altRadius !== undefined ? altRadius : this.radius;
    const pos = new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta)
    );
    pos.applyEuler(this.group.rotation);
    return pos;
  }

  update(time) {
    if (this.cloudMesh) {
      this.cloudMesh.material.uniforms.time.value = time * 0.001;
    }
    if (this.earthMesh) {
      const sunDir = new THREE.Vector3(
        Math.cos(time * 0.00004),
        0.12,
        Math.sin(time * 0.00004)
      ).normalize();
      this.sunDirection.copy(sunDir);
      this.earthMesh.material.uniforms.sunDirection.value = sunDir;
      if (this.atmosphereMesh) {
        this.atmosphereMesh.material.uniforms.sunDirection.value = sunDir;
      }
    }
  }
}
