const TEXTURE_SOURCES = {
  day: [
    'https://unpkg.com/three@0.128.0/examples/textures/planets/earth_atmos_2048.jpg',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/textures/planets/earth_atmos_2048.jpg',
  ],
  night: [
    'https://unpkg.com/three@0.128.0/examples/textures/planets/earth_lights_2048.png',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/textures/planets/earth_lights_2048.png',
  ],
  specular: [
    'https://unpkg.com/three@0.128.0/examples/textures/planets/earth_specular_2048.jpg',
    'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/textures/planets/earth_specular_2048.jpg',
  ]
};

function loadTextureWithFallback(loader, urls, onSuccess) {
  const tryNext = (index) => {
    if (index >= urls.length) { onSuccess(null); return; }
    loader.load(urls[index], onSuccess, undefined, () => tryNext(index + 1));
  };
  tryNext(0);
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
    this.texturesLoaded = 0;
    this.totalTextures = 3;
    this.onReady = null;
    this.sunDirection = new THREE.Vector3(5, 1, 3).normalize();
    this.init();
  }

  init() {
    this.createAtmosphere();
    this.createOuterGlow();
    this.loadTextures();
  }

  loadTextures() {
    const loader = new THREE.TextureLoader();
    loader.crossOrigin = 'anonymous';
    const textures = {};

    const onLoad = (name, texture) => {
      textures[name] = texture;
      this.texturesLoaded++;
      const pct = Math.round((this.texturesLoaded / this.totalTextures) * 100);
      if (window.updateLoader) window.updateLoader(pct);
      if (this.texturesLoaded === this.totalTextures) {
        this.buildEarth(textures);
        this.createClouds();
        if (this.onReady) this.onReady();
      }
    };

    loadTextureWithFallback(loader, TEXTURE_SOURCES.day, t => onLoad('day', t));
    loadTextureWithFallback(loader, TEXTURE_SOURCES.night, t => onLoad('night', t));
    loadTextureWithFallback(loader, TEXTURE_SOURCES.specular, t => onLoad('specular', t));
  }

  buildEarth(textures) {
    const geometry = new THREE.SphereGeometry(this.radius, 64, 64);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture:      { value: textures.day },
        nightTexture:    { value: textures.night },
        specularTexture: { value: textures.specular },
        sunDirection:    { value: this.sunDirection.clone() },
        hasNight:        { value: textures.night ? 1.0 : 0.0 },
        hasSpecular:     { value: textures.specular ? 1.0 : 0.0 }
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
        uniform sampler2D specularTexture;
        uniform vec3 sunDirection;
        uniform float hasNight;
        uniform float hasSpecular;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;

        void main() {
          vec3 normal = normalize(vNormal);
          vec3 sun = normalize(sunDirection);
          float sunDot = dot(normal, sun);
          float dayNight = smoothstep(-0.2, 0.3, sunDot);

          vec3 dayColor = texture2D(dayTexture, vUv).rgb;
          vec3 nightColor = hasNight > 0.5 ? texture2D(nightTexture, vUv).rgb * 2.5 : vec3(0.0);

          float diffuse = max(0.0, sunDot);
          float ambient = 0.12;
          vec3 dayLit = dayColor * (ambient + diffuse * 1.1);

          float specMask = hasSpecular > 0.5 ? texture2D(specularTexture, vUv).r : 0.3;
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          vec3 halfVec = normalize(sun + viewDir);
          float spec = pow(max(dot(normal, halfVec), 0.0), 64.0) * specMask * 0.5;

          vec3 color = mix(nightColor, dayLit, dayNight) + spec * dayNight;
          color = pow(max(color, vec3(0.0)), vec3(0.95));

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
      uniforms: {
        time: { value: 0.0 }
      },
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

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }
        float fbm(vec2 p) {
          float v=0.0,a=0.5;
          for(int i=0;i<6;i++){v+=a*noise(p);p*=2.0;a*=0.5;}
          return v;
        }

        void main() {
          vec2 uv = vUv + vec2(time * 0.004, 0.0);
          float cloud = fbm(uv * 3.5) * fbm(uv * 1.8 + vec2(3.2, 7.1));
          cloud = smoothstep(0.22, 0.55, cloud);
          vec3 viewDir = normalize(cameraPosition - vec3(0.0));
          float edge = dot(normalize(vNormal), viewDir);
          float alpha = cloud * 0.25 * smoothstep(0.0, 0.3, edge);
          gl_FragColor = vec4(1.0, 1.0, 1.0, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending
    });

    this.cloudMesh = new THREE.Mesh(geometry, material);
    this.group.add(this.cloudMesh);
  }

  createAtmosphere() {
    const geometry = new THREE.SphereGeometry(this.radius + 0.18, 64, 64);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: this.sunDirection.clone() }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sunDirection;
        varying vec3 vNormal;
        varying vec3 vWorldPos;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vWorldPos);
          float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
          rim = pow(rim, 2.8);
          float sunFacing = dot(vNormal, normalize(sunDirection)) * 0.5 + 0.5;
          vec3 atmoColor = mix(vec3(0.02, 0.06, 0.2), vec3(0.2, 0.55, 1.0), sunFacing);
          gl_FragColor = vec4(atmoColor, rim * 0.7);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending
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
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec3 vNormal;
        void main() {
          float rim = 1.0 - max(dot(normalize(cameraPosition), vNormal), 0.0);
          rim = pow(rim, 4.5) * 0.35;
          gl_FragColor = vec4(0.08, 0.35, 1.0, rim);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
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
