class Earth {
  constructor(scene) {
    this.scene = scene;
    this.earthMesh = null;
    this.cloudMesh = null;
    this.atmosphereMesh = null;
    this.glowMesh = null;
    this.radius = 5;
    this.texturesLoaded = 0;
    this.totalTextures = 4;
    this.onReady = null;
    this.init();
  }

  init() {
    this.loadTextures();
    this.createAtmosphere();
    this.createOuterGlow();
  }

  loadTextures() {
    const loader = new THREE.TextureLoader();
    const textures = {};

    const onLoad = (name, texture) => {
      textures[name] = texture;
      this.texturesLoaded++;
      const pct = Math.round((this.texturesLoaded / this.totalTextures) * 100);
      if (window.updateLoader) window.updateLoader(pct);
      if (this.texturesLoaded === this.totalTextures) {
        this.buildEarth(textures);
        if (this.onReady) this.onReady();
      }
    };

    loader.load(
      'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_atmos_2048.jpg',
      t => onLoad('day', t),
      undefined,
      () => { loader.load('https://threejs.org/examples/textures/planets/earth_atmos_2048.jpg', t => onLoad('day', t)); }
    );

    loader.load(
      'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_lights_2048.png',
      t => onLoad('night', t),
      undefined,
      () => { this.texturesLoaded++; onLoad('night', null); }
    );

    loader.load(
      'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_normal_2048.jpg',
      t => onLoad('normal', t),
      undefined,
      () => { this.texturesLoaded++; onLoad('normal', null); }
    );

    loader.load(
      'https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/textures/planets/earth_specular_2048.jpg',
      t => onLoad('specular', t),
      undefined,
      () => { this.texturesLoaded++; onLoad('specular', null); }
    );
  }

  buildEarth(textures) {
    const geometry = new THREE.SphereGeometry(this.radius, 64, 64);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        dayTexture:     { value: textures.day },
        nightTexture:   { value: textures.night },
        normalTexture:  { value: textures.normal },
        specularTexture:{ value: textures.specular },
        sunDirection:   { value: new THREE.Vector3(1, 0, 0) },
        time:           { value: 0 }
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vUv = uv;
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform sampler2D dayTexture;
        uniform sampler2D nightTexture;
        uniform sampler2D normalTexture;
        uniform sampler2D specularTexture;
        uniform vec3 sunDirection;
        uniform float time;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vPosition;

        void main() {
          vec3 normal = normalize(vNormal);
          float sunDot = dot(normal, normalize(sunDirection));
          float dayNight = smoothstep(-0.15, 0.25, sunDot);

          vec4 dayColor = texture2D(dayTexture, vUv);
          vec4 nightColor = nightTexture != null ? texture2D(nightTexture, vUv) : vec4(0.0);

          vec3 nightGlow = nightColor.rgb * 1.8;
          vec3 dayLit = dayColor.rgb * max(0.05, sunDot * 1.2 + 0.1);

          vec3 specColor = specularTexture != null ? texture2D(specularTexture, vUv).rgb : vec3(0.3);
          vec3 viewDir = normalize(cameraPosition - vPosition);
          vec3 reflectDir = reflect(-normalize(sunDirection), normal);
          float spec = pow(max(dot(viewDir, reflectDir), 0.0), 32.0) * specColor.r * 0.6;

          vec3 finalColor = mix(nightGlow, dayLit, dayNight) + spec * dayNight;
          finalColor = pow(finalColor, vec3(0.9));

          gl_FragColor = vec4(finalColor, 1.0);
        }
      `
    });

    this.earthMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.earthMesh);

    this.createClouds(textures.day);
  }

  createClouds(baseTexture) {
    const geometry = new THREE.SphereGeometry(this.radius + 0.05, 48, 48);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        opacity: { value: 0.18 }
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
        uniform float opacity;
        varying vec2 vUv;
        varying vec3 vNormal;

        float hash(vec2 p) {
          return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
        }

        float noise(vec2 p) {
          vec2 i = floor(p);
          vec2 f = fract(p);
          f = f * f * (3.0 - 2.0 * f);
          return mix(
            mix(hash(i), hash(i + vec2(1,0)), f.x),
            mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
            f.y
          );
        }

        float fbm(vec2 p) {
          float v = 0.0;
          float a = 0.5;
          for (int i = 0; i < 5; i++) {
            v += a * noise(p);
            p *= 2.0;
            a *= 0.5;
          }
          return v;
        }

        void main() {
          vec2 uv = vUv + vec2(time * 0.003, 0.0);
          float cloud = fbm(uv * 4.0) * fbm(uv * 2.0 + vec2(1.7, 9.2));
          cloud = smoothstep(0.28, 0.6, cloud);
          float edge = dot(vNormal, vec3(0, 0, 1)) * 0.3 + 0.7;
          gl_FragColor = vec4(1.0, 1.0, 1.0, cloud * opacity * edge);
        }
      `,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.FrontSide
    });

    this.cloudMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.cloudMesh);
  }

  createAtmosphere() {
    const geometry = new THREE.SphereGeometry(this.radius + 0.15, 64, 64);
    const material = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: new THREE.Vector3(1, 0, 0) }
      },
      vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vPosition = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 sunDirection;
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
          vec3 viewDir = normalize(cameraPosition - vPosition);
          float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
          rim = pow(rim, 3.5);
          float sunFacing = dot(vNormal, normalize(sunDirection)) * 0.5 + 0.5;
          vec3 dayAtmo = vec3(0.15, 0.5, 1.0);
          vec3 nightAtmo = vec3(0.02, 0.05, 0.15);
          vec3 atmoColor = mix(nightAtmo, dayAtmo, sunFacing);
          float alpha = rim * 0.6;
          gl_FragColor = vec4(atmoColor, alpha);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      blending: THREE.AdditiveBlending
    });

    this.atmosphereMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.atmosphereMesh);
  }

  createOuterGlow() {
    const geometry = new THREE.SphereGeometry(this.radius + 0.6, 32, 32);
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
          vec3 viewDir = normalize(cameraPosition - position);
          float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
          rim = pow(rim, 5.0) * 0.4;
          gl_FragColor = vec4(0.1, 0.4, 1.0, rim);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending
    });

    this.glowMesh = new THREE.Mesh(geometry, material);
    this.scene.add(this.glowMesh);
  }

  latLngToVec3(lat, lng, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    const r = radius || this.radius;
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
       r * Math.cos(phi),
       r * Math.sin(phi) * Math.sin(theta)
    );
  }

  update(time) {
    if (this.cloudMesh) {
      this.cloudMesh.material.uniforms.time.value = time;
      this.cloudMesh.rotation.y = time * 0.00015;
    }
    if (this.earthMesh) {
      this.earthMesh.material.uniforms.time.value = time;
      const sunDir = new THREE.Vector3(
        Math.cos(time * 0.00005),
        0.15,
        Math.sin(time * 0.00005)
      ).normalize();
      this.earthMesh.material.uniforms.sunDirection.value = sunDir;
      if (this.atmosphereMesh) {
        this.atmosphereMesh.material.uniforms.sunDirection.value = sunDir;
      }
    }
  }
}
