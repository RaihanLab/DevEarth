const LANG_COLORS = {
  JavaScript:  '#f7df1e',
  TypeScript:  '#3178c6',
  Python:      '#3776ab',
  Java:        '#ed8b00',
  'C++':       '#00599c',
  C:           '#aaaaaa',
  'C#':        '#239120',
  Go:          '#00add8',
  Rust:        '#ce422b',
  Ruby:        '#cc342d',
  PHP:         '#9b59b6',
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
    this.beams = [];
    this.trails = [];
    this.heatZones = {};
    this.langCounts = {};
    this.lastCommitPos = null;
    this.lastCommitColor = null;
  }

  spawnCommit(lat, lng, lang, data) {
    const color = getLangColor(lang);
    const colorObj = new THREE.Color(color);

    this.langCounts[lang] = (this.langCounts[lang] || 0) + 1;

    const position = this.earth.latLngToVec3(lat, lng, this.earth.radius);

    this.spawnImpactDot(position, colorObj, data);
    this.spawnRipples(position, colorObj);
    this.spawnBeam(position, colorObj);
    this.spawnParticles(position, colorObj);
    this.updateHeatZone(lat, lng, colorObj);

    if (this.lastCommitPos) {
      this.spawnShootingTrail(this.lastCommitPos, position, this.lastCommitColor || colorObj);
    }

    this.lastCommitPos = position.clone();
    this.lastCommitColor = colorObj.clone();
  }

  spawnImpactDot(position, color, data) {
    const geometry = new THREE.SphereGeometry(0.07, 10, 10);
    const material = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });
    const dot = new THREE.Mesh(geometry, material);
    dot.position.copy(position);

    this.scene.add(dot);
    this.pulses.push({ mesh: dot, age: 0, maxAge: 220, type: 'dot', data });
  }

  spawnRipples(position, color) {
    const normal = position.clone().normalize();

    for (let i = 0; i < 4; i++) {
      const geometry = new THREE.RingGeometry(0.001, 0.05, 40);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const ring = new THREE.Mesh(geometry, material);
      ring.position.copy(position);
      ring.lookAt(position.clone().add(normal));

      this.scene.add(ring);
      this.ripples.push({
        mesh: ring,
        age: i * 18,
        maxAge: 110,
        startScale: 0.05,
        endScale: 5.0
      });
    }
  }

  spawnBeam(position, color) {
    const normal = position.clone().normalize();
    const beamEnd = position.clone().addScaledVector(normal, 2.2);

    const points = [position.clone(), beamEnd];
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 1.0,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const beam = new THREE.Line(geometry, material);
    this.scene.add(beam);
    this.beams.push({ mesh: beam, age: 0, maxAge: 50 });
  }

  spawnParticles(position, color) {
    const count = 14;
    const normal = position.clone().normalize();
    const tangent = new THREE.Vector3(-normal.z, 0, normal.x).normalize();
    const bitangent = normal.clone().cross(tangent);

    for (let i = 0; i < count; i++) {
      const geometry = new THREE.SphereGeometry(0.022, 4, 4);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 1.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });

      const particle = new THREE.Mesh(geometry, material);
      particle.position.copy(position);

      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const speed = 0.025 + Math.random() * 0.03;
      const lift = 0.01 + Math.random() * 0.02;

      const velocity = tangent.clone().multiplyScalar(Math.cos(angle) * speed)
        .addScaledVector(bitangent, Math.sin(angle) * speed)
        .addScaledVector(normal, lift);

      this.scene.add(particle);
      this.pulses.push({
        mesh: particle,
        age: 0,
        maxAge: 50 + Math.random() * 30,
        velocity,
        type: 'particle'
      });
    }
  }

  spawnShootingTrail(from, to, color) {
    const dist = from.distanceTo(to);
    if (dist < 0.5 || dist > 20) return;

    const mid = from.clone().add(to).multiplyScalar(0.5);
    const lift = mid.clone().normalize().multiplyScalar(this.earth.radius * 0.45);
    const controlPoint = mid.add(lift);

    const curve = new THREE.QuadraticBezierCurve3(from, controlPoint, to);
    const points = curve.getPoints(40);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    const trail = new THREE.Line(geometry, material);
    this.scene.add(trail);
    this.trails.push({ mesh: trail, age: 0, maxAge: 80 });
  }

  updateHeatZone(lat, lng, color) {
    const key = `${Math.round(lat / 8) * 8}_${Math.round(lng / 8) * 8}`;
    const pos = this.earth.latLngToVec3(
      Math.round(lat / 8) * 8,
      Math.round(lng / 8) * 8,
      this.earth.radius + 0.02
    );

    if (!this.heatZones[key]) {
      const geometry = new THREE.SphereGeometry(0.18, 12, 12);
      const material = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(pos);
      this.scene.add(mesh);
      this.heatZones[key] = { mesh, heat: 0, color };
    }

    const zone = this.heatZones[key];
    zone.heat = Math.min(zone.heat + 0.25, 1.0);
    zone.mesh.material.color = color;
  }

  update() {
    for (let i = this.pulses.length - 1; i >= 0; i--) {
      const p = this.pulses[i];
      p.age++;
      const t = p.age / p.maxAge;

      if (p.type === 'dot') {
        if (t < 0.25) {
          p.mesh.material.opacity = t / 0.25;
          p.mesh.scale.setScalar(1 + t * 3);
        } else if (t < 0.75) {
          p.mesh.material.opacity = 1.0;
        } else {
          p.mesh.material.opacity = 1 - (t - 0.75) / 0.25;
        }
      } else if (p.type === 'particle') {
        p.mesh.position.add(p.velocity);
        p.velocity.multiplyScalar(0.90);
        p.mesh.material.opacity = Math.pow(1 - t, 1.5);
      }

      if (p.age >= p.maxAge) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        p.mesh.material.dispose();
        this.pulses.splice(i, 1);
      }
    }

    for (let i = this.ripples.length - 1; i >= 0; i--) {
      const r = this.ripples[i];
      r.age++;
      const t = r.age / r.maxAge;
      r.mesh.scale.setScalar(r.startScale + (r.endScale - r.startScale) * t);
      r.mesh.material.opacity = Math.pow(1 - t, 1.5) * 0.7;

      if (r.age >= r.maxAge) {
        this.scene.remove(r.mesh);
        r.mesh.geometry.dispose();
        r.mesh.material.dispose();
        this.ripples.splice(i, 1);
      }
    }

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.age++;
      b.mesh.material.opacity = 1 - b.age / b.maxAge;

      if (b.age >= b.maxAge) {
        this.scene.remove(b.mesh);
        b.mesh.geometry.dispose();
        b.mesh.material.dispose();
        this.beams.splice(i, 1);
      }
    }

    for (let i = this.trails.length - 1; i >= 0; i--) {
      const tr = this.trails[i];
      tr.age++;
      tr.mesh.material.opacity = (1 - tr.age / tr.maxAge) * 0.7;

      if (tr.age >= tr.maxAge) {
        this.scene.remove(tr.mesh);
        tr.mesh.geometry.dispose();
        tr.mesh.material.dispose();
        this.trails.splice(i, 1);
      }
    }

    for (const key in this.heatZones) {
      const zone = this.heatZones[key];
      zone.heat *= 0.997;
      zone.mesh.material.opacity = zone.heat * 0.35;
      zone.mesh.scale.setScalar(1 + zone.heat * 0.8);
    }
  }

  getTopLanguages(n = 8) {
    return Object.entries(this.langCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, n);
  }
}
