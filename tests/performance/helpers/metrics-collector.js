class PerformanceMetricsCollector {
  constructor(page) {
    this.page = page;
    this.metrics = [];
  }
  
  async startCollection() {
    await this.page.addInitScript(() => {
      window.__perfMetrics = {
        marks: {},
        measures: [],
        resources: []
      };
      
      try {
        const paintObserver = new PerformanceObserver((list) => {
          list.getEntries().forEach(entry => {
            window.__perfMetrics.marks[entry.name] = entry.startTime;
          });
        });
        paintObserver.observe({ type: 'paint', buffered: true });
      } catch (e) {
        console.warn('Paint observer not supported');
      }
      
      try {
        const navObserver = new PerformanceObserver((list) => {
          window.__perfMetrics.navigation = list.getEntries()[0];
        });
        navObserver.observe({ type: 'navigation', buffered: true });
      } catch (e) {
        console.warn('Navigation observer not supported');
      }
      
      try {
        const resourceObserver = new PerformanceObserver((list) => {
          window.__perfMetrics.resources.push(...list.getEntries());
        });
        resourceObserver.observe({ type: 'resource', buffered: true });
      } catch (e) {
        console.warn('Resource observer not supported');
      }
    });
  }
  
  async mark(name) {
    await this.page.evaluate((n) => {
      performance.mark(n);
      window.__perfMetrics.marks[n] = performance.now();
    }, name);
  }
  
  async measure(name, startMark, endMark) {
    await this.page.evaluate((n, s, e) => {
      performance.measure(n, s, e);
      const measure = performance.getEntriesByName(n)[0];
      if (measure) {
        window.__perfMetrics.measures.push(measure);
      }
    }, name, startMark, endMark);
  }
  
  async getMetrics() {
    return await this.page.evaluate(() => window.__perfMetrics);
  }
  
  async getOpenLayersMetrics() {
    return await this.page.evaluate(() => {
      let cogSource = window.cogSource;
      let map = window.map;
      
      if (!cogSource && map) {
        const layers = map.getLayers().getArray();
        for (const layer of layers) {
          if (layer.getSource && layer.getSource().getState) {
            const source = layer.getSource();
            if (source.getState && typeof source.getState === 'function') {
              cogSource = source;
              break;
            }
          }
        }
      }
      
      if (!cogSource && !map) {
        return null;
      }
      
      const metrics = {
        hasMap: !!map,
        hasSource: !!cogSource
      };
      
      if (map) {
        const view = map.getView();
        metrics.mapCenter = view.getCenter();
        metrics.mapZoom = view.getZoom();
        metrics.mapResolution = view.getResolution();
      }
      
      if (cogSource) {
        metrics.sourceState = cogSource.getState();
        
        if (cogSource.getTileCache) {
          const cache = cogSource.getTileCache();
          metrics.tileCacheCount = cache.getCount();
        }
        
        if (cogSource.getKeys) {
          metrics.sourceKeys = cogSource.getKeys();
        }
      }
      
      return metrics;
    });
  }
  
  async clearMetrics() {
    await this.page.evaluate(() => {
      window.__perfMetrics = {
        marks: {},
        measures: [],
        resources: []
      };
    });
  }
}

const networkConditions = {
  wifi: { 
    downloadThroughput: 100 * 1024 * 1024 / 8, 
    uploadThroughput: 50 * 1024 * 1024 / 8, 
    latency: 2 
  },
  '4g': { 
    downloadThroughput: 20 * 1024 * 1024 / 8, 
    uploadThroughput: 10 * 1024 * 1024 / 8, 
    latency: 50 
  },
  '3g': { 
    downloadThroughput: 1.6 * 1024 * 1024 / 8, 
    uploadThroughput: 768 * 1024 / 8, 
    latency: 300 
  }
};

async function emulateNetwork(page, condition) {
  if (!networkConditions[condition]) {
    throw new Error(`Unknown network condition: ${condition}`);
  }
  
  const client = await page.context().newCDPSession(page);
  await client.send('Network.emulateNetworkConditions', {
    offline: false,
    downloadThroughput: networkConditions[condition].downloadThroughput,
    uploadThroughput: networkConditions[condition].uploadThroughput,
    latency: networkConditions[condition].latency
  });
}

function formatDuration(ms) {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

function calculateStats(values) {
  if (values.length === 0) return null;
  
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const sorted = [...values].sort((a, b) => a - b);
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || max;
  
  return { avg, min, max, p95 };
}

export {
  PerformanceMetricsCollector,
  emulateNetwork,
  networkConditions,
  formatDuration,
  calculateStats
};
