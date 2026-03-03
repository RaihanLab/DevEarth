const LANG_COLORS = {
  JavaScript:  '#f7df1e',
  TypeScript:  '#3178c6',
  Python:      '#3776ab',
  Java:        '#ed8b00',
  'C++':       '#00599c',
  C:           '#555555',
  'C#':        '#239120',
  Go:          '#00add8',
  Rust:        '#ce422b',
  Ruby:        '#cc342d',
  PHP:         '#777bb4',
  Swift:       '#fa7343',
  Kotlin:      '#7f52ff',
  Dart:        '#00b4ab',
  HTML:        '#e34c26',
  CSS:         '#264de4',
  Shell:       '#89e051',
  Scala:       '#dc322f',
  R:           '#276dc3',
  Lua:         '#000080',
  Haskell:     '#5d4f85',
  Vue:         '#42b883',
  default:     '#00f5ff'
};

function getLangColor(lang) {
  return LANG_COLORS[lang] || LANG_COLORS.default;
}

class PulseSystem {
  constructor(scene, earth) {
    this.scene = scene;
    this.earth = earth;
    this.pulses = [];
    this.ripples = [];
    this.trails = [];
    this.langCounts = {};
  }

  spawnCommit(lat, lng, lang, data) {
    const color = getLangColor(lang);
    const colorObj = new THREE.Color(color);

    this.langCounts[lang] = (this.langCounts[lang] || 0) + 1;

    const position = this.earth.latLngToVec3(lat, lng, this.earth.radius);
    const surfacePos = position.clone();

    this.spawnImpactDot(surfacePos, colorObj, data);
    this.spawnRipple(surfacePos, colorObj);
    this.spawnBeam(surfacePos, colorObj);
    this.spawnParticles(surfacePos, colorObj);
  }

  spawnImpactDot(position, color, data) {
    const geometry = new THREE.SphereGeometry(0.04, 8, 8);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const dot = new THREE.Mesh(geometry, material);
    dot.position.copy(position);

    const pulse = {
      mesh: dot,
      age: 0,
      maxAge: 180,
      type: 'dot',
      data
    };

    this.scene.add(dot);
    this.pulses.push(pulse);
  }

  spawnRipple(position, color) {
    const normal = position.clone().normalize();

    for (let i = 0; i < 3; i++) {
      const geometry = new THREE.RingGeometry(0.001, 0.04, 32);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const ring = new THREE.Mesh(geometry, material);
      ring.position.copy(position);
      ring.lookAt(position.clone().add(normal));

      const ripple = {
        mesh: ring,
        age: i * 20,
        maxAge: 90,
        startScale: 0.1,
        endScale: 3.5,
        type: 'ripple'
      };

      this.scene.add(ring);
      this.ripples.push(ripple);
    }
  }

  spawnBeam(position, color) {
    const normal = position.clone().normalize();
    const beamEnd = position.clone().add(normal.multiplyScalar(1.5));

    const points = [position.clone(), beamEnd];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const beam = new THREE.Line(geometry, material);

    const trail = {
      mesh: beam,
      age: 0,
      maxAge: 40,
      type: 'beam'
    };

    this.scene.add(beam);
    this.trails.push(trail);
  }

  spawnParticles(position, color) {
    const count = 8;
    for (let i = 0; i < count; i++) {
      const geometry = new THREE.SphereGeometry(0.015, 4, 4);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const particle = new THREE.Mesh(geometry, material);
      particle.position.copy(position);

      const normal = position.clone().normalize();
      const tangent = new THREE.Vector3(-normal.z, 0, normal.x).normalize();
      const bitangent = normal.clone().cross(tangent);

      const angle = (i / count) * Math.PI * 2;
      const speed = 0.02 + Math.random() * 0.02;
      const velocity = tangent.clone().multiplyScalar(Math.cos(angle) * speed)
        .add(bitangent.clone().multiplyScalar(Math.sin(angle) * speed))
        .add(normal.clone().multiplyScalar(speed * 0.5));

      const pulse = {
        mesh: particle,
        age: 0,
        maxAge: 40 + Math.random() * 20,
        velocity,
        type: 'particle'
      };

      this.scene.add(particle);
      this.pulses.push(pulse);
    }
  }

  update() {
    const toRemove = [];

    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.age++;

      const t = p.age / p.maxAge;

      if (p.type === 'dot') {
        if (t < 0.3) {
          p.mesh.material.opacity = t / 0.3;
          const s = 1 + t * 2;
          p.mesh.scale.setScalar(s);
        } else if (t > 0.7) {
          p.mesh.material.opacity = 1 - (t - 0.7) / 0.3;
        }
      } else if (p.type === 'particle') {
        p.mesh.position.add(p.velocity);
        p.velocity.multiplyScalar(0.92);
        p.mesh.material.opacity = 1 - t;
        const s = 1 - t * 0.5;
        p.mesh.scale.setScalar(s);
      }

      if (p.age >= p.maxAge) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        toRemove.push(i);
      }
    }

    toRemove.forEach(i => this.pulses.splice(i, 1));

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.age++;
      const t = r.age / r.maxAge;
      const scale = r.startScale + (r.endScale - r.startScale) * t;
      r.mesh.scale.setScalar(scale);
      r.mesh.material.opacity = (1 - t) * 0.6;

      if (r.age >= r.maxAge) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        this.ripples.splice(i, 1);
      }
    }

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const tr = this.trails[i];
      tr.age++;
      const t = tr.age / tr.maxAge;
      tr.mesh.material.opacity = 1 - t;

      if (tr.age >= tr.maxAge) {
        this.scene.remove(tr.mesh);
        tr.mesh.geometry.dispose();
        tr.mesh.material.dispose();
        this.trails.splice(i, 1);
      }
    }
  }

  getTopLanguages(n = 8) {
    return Object.entries(this.langCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  }
}
