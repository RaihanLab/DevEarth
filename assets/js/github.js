const LOCATION_CACHE = {};
const GEOCODE_QUEUE = [];
let geocodingBusy = false;

const COUNTRY_COORDS = {
  'United States': [37.0902, -95.7129], 'US': [37.0902, -95.7129],
  'United Kingdom': [55.3781, -3.4360], 'UK': [55.3781, -3.4360],
  'Germany': [51.1657, 10.4515], 'France': [46.2276, 2.2137],
  'Japan': [36.2048, 138.2529], 'China': [35.8617, 104.1954],
  'India': [20.5937, 78.9629], 'Canada': [56.1304, -106.3468],
  'Australia': [25.2744, 133.7751], 'Brazil': [14.2350, -51.9253],
  'Russia': [61.5240, 105.3188], 'South Korea': [35.9078, 127.7669],
  'Netherlands': [52.1326, 5.2913], 'Sweden': [60.1282, 18.6435],
  'Norway': [60.4720, 8.4689], 'Denmark': [56.2639, 9.5018],
  'Finland': [61.9241, 25.7482], 'Switzerland': [46.8182, 8.2275],
  'Spain': [40.4637, -3.7492], 'Italy': [41.8719, 12.5674],
  'Poland': [51.9194, 19.1451], 'Ukraine': [48.3794, 31.1656],
  'Turkey': [38.9637, 35.2433], 'Iran': [32.4279, 53.6880],
  'Pakistan': [30.3753, 69.3451], 'Bangladesh': [23.6850, 90.3563],
  'Indonesia': [-0.7893, 113.9213], 'Mexico': [23.6345, -102.5528],
  'Argentina': [-38.4161, -63.6167], 'Chile': [-35.6751, -71.5430],
  'South Africa': [-30.5595, 22.9375], 'Nigeria': [9.0820, 8.6753],
  'Egypt': [26.8206, 30.8025], 'Singapore': [1.3521, 103.8198],
  'Taiwan': [23.6978, 120.9605], 'Israel': [31.0461, 34.8516],
  'Portugal': [39.3999, -8.2245], 'Czech Republic': [49.8175, 15.4730],
  'Romania': [45.9432, 24.9668], 'Hungary': [47.1625, 19.5033],
  'Austria': [47.5162, 14.5501], 'Belgium': [50.5039, 4.4699],
  'Greece': [39.0742, 21.8243], 'Vietnam': [14.0583, 108.2772],
  'Thailand': [15.8700, 100.9925], 'Malaysia': [4.2105, 101.9758],
  'Philippines': [12.8797, 121.7740], 'New Zealand': [-40.9006, 174.8860],
  'Ireland': [53.4129, -8.2439], 'Colombia': [4.5709, -74.2973],
  'Peru': [-9.1900, -75.0152], 'Morocco': [31.7917, -7.0926],
};

function parseLocation(locationStr) {
  if (!locationStr) return null;
  const loc = locationStr.trim();
  if (LOCATION_CACHE[loc]) return Promise.resolve(LOCATION_CACHE[loc]);

  for (const [country, coords] of Object.entries(COUNTRY_COORDS)) {
    if (loc.toLowerCase().includes(country.toLowerCase())) {
      const jitter = [(Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8];
      const result = [coords[0] + jitter[0], coords[1] + jitter[1]];
      LOCATION_CACHE[loc] = result;
      return Promise.resolve(result);
    }
  }

  return new Promise((resolve) => {
    GEOCODE_QUEUE.push({ loc, resolve });
    processGeocodeQueue();
  });
}

async function processGeocodeQueue() {
  if (geocodingBusy || GEOCODE_QUEUE.length === 0) return;
  geocodingBusy = true;

  const { loc, resolve } = GEOCODE_QUEUE.shift();

  try {
    await new Promise(r => setTimeout(r, 300));
    const url = `https://geocode.maps.co/search?q=${encodeURIComponent(loc)}&limit=1`;
    const res = await fetch(url);
    const data = await res.json();
    if (data && data[0]) {
      const result = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      LOCATION_CACHE[loc] = result;
      resolve(result);
    } else {
      resolve(null);
    }
  } catch {
    resolve(null);
  }

  geocodingBusy = false;
  processGeocodeQueue();
}

function randomCoords() {
  return [
    (Math.random() - 0.5) * 140,
    (Math.random() - 0.5) * 360
  ];
}

class GitHubFeed {
  constructor(onCommit) {
    this.onCommit = onCommit;
    this.lastEventId = null;
    this.seenIds = new Set();
    this.pollInterval = 5000;
    this.commitsPerMin = 0;
    this.commitBuffer = [];
    this.totalCommits = 0;
    this.uniqueDevs = new Set();
    this.uniqueCountries = new Set();
    this.running = false;
  }

  start() {
    this.running = true;
    this.poll();
    setInterval(() => this.updateRate(), 60000);
  }

  stop() {
    this.running = false;
  }

  async poll() {
    if (!this.running) return;

    try {
      const res = await fetch('https://api.github.com/events?per_page=30', {
        headers: { 'Accept': 'application/vnd.github.v3+json' }
      });

      if (res.status === 403 || res.status === 429) {
        const retry = parseInt(res.headers.get('X-RateLimit-Reset') || '0') * 1000;
        const wait = Math.max(retry - Date.now(), 30000);
        if (window.setStatus) window.setStatus('RATE LIMITED');
        setTimeout(() => this.poll(), wait);
        return;
      }

      if (res.ok) {
        const events = await res.json();
        await this.processEvents(events);
        if (window.setStatus) window.setStatus('LIVE');
      }
    } catch {
      if (window.setStatus) window.setStatus('RECONNECTING');
    }

    const delay = this.pollInterval + Math.random() * 2000;
    setTimeout(() => this.poll(), delay);
  }

  async processEvents(events) {
    const pushEvents = events
      .filter(e => e.type === 'PushEvent' && !this.seenIds.has(e.id))
      .slice(0, 8);

    for (const event of pushEvents) {
      this.seenIds.add(event.id);
      if (this.seenIds.size > 2000) {
        const first = this.seenIds.values().next().value;
        this.seenIds.delete(first);
      }

      const login = event.actor?.login || 'unknown';
      const repo = event.repo?.name || '';
      const lang = event.payload?.commits?.[0]?.message?.includes('.py') ? 'Python' : null;
      const commits = event.payload?.commits || [];
      const commitCount = commits.length;

      this.uniqueDevs.add(login);
      this.totalCommits += commitCount;
      this.commitBuffer.push(Date.now());

      const userLocation = await this.fetchUserLocation(login);
      let coords = null;

      if (userLocation) {
        coords = await parseLocation(userLocation);
        if (coords) {
          const country = this.extractCountry(userLocation);
          if (country) this.uniqueCountries.add(country);
        }
      }

      if (!coords) {
        coords = randomCoords();
      }

      const commitLang = await this.detectLanguage(event.repo?.name);

      this.onCommit({
        lat: coords[0],
        lng: coords[1],
        lang: commitLang || 'default',
        user: login,
        repo: repo.split('/')[1] || repo,
        message: commits[0]?.message?.slice(0, 60) || '',
        count: commitCount,
        location: userLocation || 'Unknown'
      });

      if (window.updateStats) {
        window.updateStats({
          total: this.totalCommits,
          devs: this.uniqueDevs.size,
          countries: this.uniqueCountries.size,
          rate: this.getRate()
        });
      }

      await new Promise(r => setTimeout(r, 200));
    }
  }

  async fetchUserLocation(login) {
    try {
      const res = await fetch(`https://api.github.com/users/${login}`);
      if (res.ok) {
        const user = await res.json();
        return user.location || null;
      }
    } catch {}
    return null;
  }

  async detectLanguage(repoFullName) {
    if (!repoFullName) return null;
    try {
      const res = await fetch(`https://api.github.com/repos/${repoFullName}`);
      if (res.ok) {
        const repo = await res.json();
        return repo.language || null;
      }
    } catch {}
    return null;
  }

  extractCountry(location) {
    if (!location) return null;
    const parts = location.split(',');
    return parts[parts.length - 1].trim();
  }

  updateRate() {
    const now = Date.now();
    this.commitBuffer = this.commitBuffer.filter(t => now - t < 60000);
    this.commitsPerMin = this.commitBuffer.length;
  }

  getRate() {
    const now = Date.now();
    this.commitBuffer = this.commitBuffer.filter(t => now - t < 60000);
    return this.commitBuffer.length;
  }
}
