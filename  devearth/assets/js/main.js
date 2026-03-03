let scene, camera, renderer, earth, stars, pulseSystem, feed;
let isDragging = false, prevMouse = { x: 0, y: 0 };
let rotationVelocity = { x: 0, y: 0 };
let autoRotate = true;
let cinematicMode = false;
let clock = { start: Date.now(), get elapsed() { return Date.now() - this.start; } };
let audioCtx = null;
let totalCommitsToday = 0;

function initScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000408);

  camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 2000);
  camera.position.set(0, 2, 14);
  camera.lookAt(0, 0, 0);

  renderer = new THREE.WebGLRenderer({
    canvas: document.getElementById('globe-canvas'),
    antialias: true,
    alpha: false
  });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;

  const ambientLight = new THREE.AmbientLight(0x111122, 0.3);
  scene.add(ambientLight);

  const sunLight = new THREE.DirectionalLight(0xfff5e0, 2.5);
  sunLight.position.set(10, 2, 5);
  scene.add(sunLight);

  stars = new StarField(scene);
  earth = new Earth(scene);
  earth.onReady = onEarthReady;

  pulseSystem = new PulseSystem(scene, earth);

  window.updateLoader = (pct) => {
    document.getElementById('loaderFill').style.width = pct + '%';
    const messages = ['Initializing Earth systems...', 'Loading NASA textures...', 'Building atmosphere...', 'Calibrating orbit...'];
    const idx = Math.floor(pct / 25);
    document.querySelector('.loader-sub').textContent = messages[Math.min(idx, 3)];
  };
}

function onEarthReady() {
  setTimeout(() => {
    const loader = document.getElementById('loading-screen');
    loader.classList.add('fade-out');
    setTimeout(() => loader.style.display = 'none', 800);
    startFeed();
  }, 600);
}

function startFeed() {
  feed = new GitHubFeed((commitData) => {
    pulseSystem.spawnCommit(commitData.lat, commitData.lng, commitData.lang, commitData);
    addFeedItem(commitData);
    playCommitSound(commitData.lang);
    totalCommitsToday++;
    updateLegend();
  });

  window.setStatus = (status) => {
    const dot = document.querySelector('.status-dot');
    const text = document.getElementById('statusText');
    if (status === 'LIVE') {
      dot.classList.add('live');
      text.textContent = 'LIVE';
    } else {
      dot.classList.remove('live');
      text.textContent = status;
    }
  };

  window.updateStats = (stats) => {
    animateNumber('statCommits', stats.rate);
    animateNumber('statTotal', stats.total);
    animateNumber('statCountries', stats.countries);
    animateNumber('statDevs', stats.devs);
  };

  feed.start();
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  const current = parseInt(el.textContent.replace(/[^0-9]/g, '')) || 0;
  const diff = target - current;
  if (diff === 0) return;
  const step = Math.ceil(Math.abs(diff) / 10);
  const newVal = current + Math.sign(diff) * Math.min(step, Math.abs(diff));
  el.textContent = newVal >= 1000 ? (newVal / 1000).toFixed(1) + 'k' : newVal;
}

function addFeedItem(data) {
  const list = document.getElementById('feedList');
  const color = getLangColor(data.lang);

  const item = document.createElement('div');
  item.className = 'feed-item';
  item.innerHTML = `
    <div class="feed-dot" style="background:${color};box-shadow:0 0 6px ${color}"></div>
    <div style="flex:1;overflow:hidden">
      <span class="feed-user">${data.user}</span>
      <span style="color:var(--muted)"> pushed to </span>
      <span class="feed-repo">${data.repo}</span>
    </div>
    <div class="feed-time">${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</div>
  `;

  list.insertBefore(item, list.firstChild);
  while (list.children.length > 12) {
    list.removeChild(list.lastChild);
  }
}

function updateLegend() {
  const top = pulseSystem.getTopLanguages(8);
  const items = document.getElementById('legendItems');
  items.innerHTML = top.map(([lang, count]) => {
    const color = getLangColor(lang);
    return `
      <div class="legend-item">
        <div class="legend-dot" style="background:${color};box-shadow:0 0 6px ${color}40"></div>
        <span>${lang}</span>
        <span class="legend-count">${count}</span>
      </div>
    `;
  }).join('');
}

function initAudio() {
  if (audioCtx) return;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch {}
}

function playCommitSound(lang) {
  if (!audioCtx) return;

  const noteMap = {
    JavaScript: 523.25, TypeScript: 587.33, Python: 659.25,
    Java: 698.46, 'C++': 783.99, Go: 880.00,
    Rust: 987.77, Ruby: 1046.50, PHP: 466.16,
    Swift: 1174.66, Kotlin: 1318.51, default: 523.25
  };

  const freq = noteMap[lang] || noteMap.default;

  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(audioCtx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, audioCtx.currentTime + 0.3);

    filter.type = 'lowpass';
    filter.frequency.value = 2000;

    gain.gain.setValueAtTime(0, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.04, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);

    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.4);
  } catch {}
}

function initControls() {
  const canvas = renderer.domElement;

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    autoRotate = false;
    prevMouse = { x: e.clientX, y: e.clientY };
    initAudio();
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const dx = e.clientX - prevMouse.x;
    const dy = e.clientY - prevMouse.y;
    rotationVelocity.y += dx * 0.003;
    rotationVelocity.x += dy * 0.003;
    prevMouse = { x: e.clientX, y: e.clientY };
  });

  canvas.addEventListener('mouseup', () => { isDragging = false; });
  canvas.addEventListener('mouseleave', () => { isDragging = false; });

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY * 0.01;
    camera.position.z = Math.max(7, Math.min(25, camera.position.z + delta));
  }, { passive: false });

  canvas.addEventListener('touchstart', (e) => {
    isDragging = true;
    autoRotate = false;
    prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    initAudio();
  });

  canvas.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    const dx = e.touches[0].clientX - prevMouse.x;
    const dy = e.touches[0].clientY - prevMouse.y;
    rotationVelocity.y += dx * 0.003;
    rotationVelocity.x += dy * 0.002;
    prevMouse = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  });

  canvas.addEventListener('touchend', () => { isDragging = false; });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'c' || e.key === 'C') {
      cinematicMode = !cinematicMode;
      document.body.classList.toggle('cinematic-mode', cinematicMode);
    }
  });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function animate() {
  requestAnimationFrame(animate);
  const time = clock.elapsed;

  if (autoRotate && earth.group) {
    earth.group.rotation.y += 0.0008;
  }

  if (!isDragging && earth.group) {
    if (Math.abs(rotationVelocity.y) > 0.0001 || Math.abs(rotationVelocity.x) > 0.0001) {
      earth.group.rotation.y += rotationVelocity.y;
      earth.group.rotation.x += rotationVelocity.x;
      earth.group.rotation.x = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, earth.group.rotation.x));
      rotationVelocity.x *= 0.94;
      rotationVelocity.y *= 0.94;
    } else if (!autoRotate) {
      autoRotate = true;
    }
  }

  earth.update(time);
  stars.update(time * 0.001);
  pulseSystem.update();

  renderer.render(scene, camera);
}

document.addEventListener('DOMContentLoaded', () => {
  initScene();
  initControls();
  animate();
});
