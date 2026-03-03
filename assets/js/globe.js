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
    this.buildEarth();
    this.createClouds();
    setTimeout(() => {
      if (window.updateLoader) window.updateLoader(100);
      if (this.onReady) this.onReady();
    }, 100);
  }

  buildEarth() {
    const geometry = new THREE.SphereGeometry(this.radius, 96, 96);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        sunDirection: { value: this.sunDirection.clone() },
        time: { value: 0.0 }
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
        uniform vec3 sunDirection;
        uniform float time;
        varying vec2 vUv;
        varying vec3 vNormal;
        varying vec3 vWorldPos;

        float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
        float hash3(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7)))*43758.5453); }

        float noise(vec2 p) {
          vec2 i = floor(p); vec2 f = fract(p);
          f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);
        }

        float fbm(vec2 p) {
          float v=0.0, a=0.5;
          for(int i=0;i<6;i++){v+=a*noise(p);p*=2.1;a*=0.5;}
          return v;
        }

        vec3 landColor(float h, float moisture) {
          if (h < 0.0) return vec3(0.0);
          vec3 deepForest = vec3(0.05, 0.18, 0.06);
          vec3 forest     = vec3(0.10, 0.28, 0.10);
          vec3 grassland  = vec3(0.22, 0.38, 0.12);
          vec3 savanna    = vec3(0.45, 0.40, 0.15);
          vec3 desert     = vec3(0.62, 0.52, 0.28);
          vec3 snow       = vec3(0.88, 0.90, 0.92);
          vec3 mountain   = vec3(0.35, 0.30, 0.26);

          vec3 col;
          float lat = abs(vUv.y - 0.5) * 2.0;
          if (lat > 0.82) return mix(mountain, snow, smoothstep(0.82, 0.95, lat));
          if (moisture > 0.55) col = mix(grassland, deepForest, (moisture - 0.55) * 4.0);
          else if (moisture > 0.35) col = mix(savanna, grassland, (moisture - 0.35) * 5.0);
          else col = mix(desert, savanna, moisture * 2.85);
          if (h > 0.65) col = mix(col, mountain, (h-0.65)*2.0);
          if (h > 0.80) col = mix(mountain, snow, (h-0.80)*4.0);
          return col;
        }

        void main() {
          float u = vUv.x;
          float v = vUv.y;

          float continent = fbm(vec2(u*2.8, v*2.8));
          float detail    = fbm(vec2(u*6.0+1.3, v*6.0+2.1)) * 0.35;
          float height    = continent + detail - 0.42;

          float moisture  = fbm(vec2(u*3.1+5.0, v*3.1+3.0));

          bool isOcean = height < 0.0;

          vec3 deepOcean    = vec3(0.02, 0.08, 0.22);
          vec3 shallowOcean = vec3(0.05, 0.20, 0.40);
          vec3 coast        = vec3(0.08, 0.28, 0.48);

          vec3 baseColor;
          if (isOcean) {
            float depth = clamp(-height * 3.0, 0.0, 1.0);
            baseColor = mix(coast, mix(shallowOcean, deepOcean, depth), depth);
          } else {
            baseColor = landColor(height, moisture);
          }

          vec3 normal = normalize(vNormal);
          vec3 sun = normalize(sunDirection);
          float sunDot = dot(normal, sun);
          float dayNight = smoothstep(-0.18, 0.28, sunDot);
          float diffuse = max(0.0, sunDot);
          float ambient = 0.10;

          vec3 dayLit = baseColor * (ambient + diffuse * 1.15);

          vec3 nightLand  = vec3(0.95, 0.80, 0.30) * 0.12;
          vec3 nightOcean = vec3(0.0);
          vec3 nightColor = isOcean ? nightOcean : nightLand;

          if (isOcean) {
            vec3 viewDir = normalize(cameraPosition - vWorldPos);
            vec3 halfVec = normalize(sun + viewDir);
            float spec = pow(max(dot(normal, halfVec), 0.0), 80.0) * 0.5 * dayNight;
            dayLit += vec3(spec * 0.8, spec * 0.9, spec);
          }

          vec3 color = mix(nightColor, dayLit, dayNight);
          color = pow(max(color, vec3(0.0)), vec3(0.92));

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
      this.earthMesh.material.uniforms.time.value = time * 0.001;
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
