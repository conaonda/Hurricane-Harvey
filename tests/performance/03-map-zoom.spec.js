import { test, expect } from '@playwright/test';

test.describe('지도 확대/축소 (Zoom) 성능 측정', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const loadingEl = document.getElementById('loading');
      return loadingEl && !loadingEl.classList.contains('active');
    }, { timeout: 30000 });
    await page.waitForTimeout(2000);
  });
  
  test('줌 인 (Zoom In) 성능 측정', async ({ page }) => {
    const metrics = await measureZoom(page, 'in', 3);
    
    console.log('\n=== 줌 인 (Zoom In) 성능 ===');
    console.log(`줌 동작 소요: ${metrics.zoomDuration.toFixed(2)}ms`);
    console.log(`타일 로딩 소요: ${metrics.tileLoadTime.toFixed(2)}ms`);
    console.log(`렌더링 소요: ${metrics.renderDuration.toFixed(2)}ms`);
    console.log(`총 소요 시간: ${metrics.totalDuration.toFixed(2)}ms`);
    
    expect(metrics.totalDuration).toBeLessThan(3000);
    expect(metrics.tileLoadTime).toBeLessThan(2000);
  });
  
  test('줌 아웃 (Zoom Out) 성능 측정', async ({ page }) => {
    await measureZoom(page, 'in', 2);
    await page.waitForTimeout(1000);
    
    const metrics = await measureZoom(page, 'out', 2);
    
    console.log('\n=== 줌 아웃 (Zoom Out) 성능 ===');
    console.log(`줌 동작 소요: ${metrics.zoomDuration.toFixed(2)}ms`);
    console.log(`타일 로딩 소요: ${metrics.tileLoadTime.toFixed(2)}ms`);
    console.log(`총 소요 시간: ${metrics.totalDuration.toFixed(2)}ms`);
    
    expect(metrics.totalDuration).toBeLessThan(3000);
  });
  
  test('연속 줌 성능 측정', async ({ page }) => {
    const results = [];
    
    for (let i = 0; i < 5; i++) {
      const metrics = await measureZoom(page, 'in', 1);
      results.push(metrics);
      await page.waitForTimeout(500);
    }
    
    const avgDuration = results.reduce((sum, r) => sum + r.totalDuration, 0) / results.length;
    const avgTileLoad = results.reduce((sum, r) => sum + r.tileLoadTime, 0) / results.length;
    
    console.log('\n=== 연속 줌 성능 (5회) ===');
    console.log(`평균 총 소요: ${avgDuration.toFixed(2)}ms`);
    console.log(`평균 타일 로딩: ${avgTileLoad.toFixed(2)}ms`);
    
    results.forEach((r, i) => {
      console.log(`  ${i + 1}회차: ${r.totalDuration.toFixed(0)}ms`);
    });
    
    expect(avgDuration).toBeLessThan(2000);
  });
  
  test('급격한 줌 변화 성능 측정', async ({ page }) => {
    const metrics = await measureZoom(page, 'in', 5);
    
    console.log('\n=== 급격한 줌 인 (5단계) ===');
    console.log(`줌 동작 소요: ${metrics.zoomDuration.toFixed(2)}ms`);
    console.log(`타일 로딩 소요: ${metrics.tileLoadTime.toFixed(2)}ms`);
    console.log(`총 소요 시간: ${metrics.totalDuration.toFixed(2)}ms`);
    
    expect(metrics.totalDuration).toBeLessThan(5000);
  });
  
  test('더블클릭 줌 성능 측정', async ({ page }) => {
    const viewport = page.viewportSize();
    const centerX = viewport ? viewport.width / 2 : 400;
    const centerY = viewport ? viewport.height / 2 : 300;
    
    const startTime = await page.evaluate(() => performance.now());
    
    await page.mouse.dblclick(centerX, centerY);
    
    await page.waitForTimeout(500);
    const zoomCompleteTime = await page.evaluate(() => performance.now());
    
    await page.waitForFunction((prevTime) => {
      return new Promise((resolve) => {
        setTimeout(() => resolve(true), 1000);
      });
    }, { timeout: 10000 }, zoomCompleteTime);
    
    const tileLoadTime = await page.evaluate(() => performance.now());
    
    console.log('\n=== 더블클릭 줌 성능 ===');
    console.log(`줌 동작 소요: ${(zoomCompleteTime - startTime).toFixed(2)}ms`);
    console.log(`타일 로딩 소요: ${(tileLoadTime - zoomCompleteTime).toFixed(2)}ms`);
    console.log(`총 소요 시간: ${(tileLoadTime - startTime).toFixed(2)}ms`);
    
    expect(tileLoadTime - startTime).toBeLessThan(3000);
  });
});

async function measureZoom(page, direction, levels) {
  const wheelDelta = direction === 'in' ? -100 : 100;
  
  const beforeCache = await page.evaluate(() => {
    let cogSource = window.cogSource;
    if (!cogSource && window.map) {
      const layers = window.map.getLayers().getArray();
      for (const layer of layers) {
        if (layer.getSource && layer.getSource().getTileCache) {
          cogSource = layer.getSource();
          break;
        }
      }
    }
    return cogSource && cogSource.getTileCache ? 
      cogSource.getTileCache().getCount() : 0;
  });
  
  const viewport = page.viewportSize();
  const centerX = viewport ? viewport.width / 2 : 400;
  const centerY = viewport ? viewport.height / 2 : 300;
  
  const startTime = await page.evaluate(() => performance.now());
  
  await page.mouse.move(centerX, centerY);
  
  for (let i = 0; i < levels; i++) {
    await page.mouse.wheel(0, wheelDelta);
    await page.waitForTimeout(200);
  }
  
  const zoomCompleteTime = await page.evaluate(() => performance.now());
  
  await page.waitForFunction((prevCount) => {
    let cogSource = window.cogSource;
    if (!cogSource && window.map) {
      const layers = window.map.getLayers().getArray();
      for (const layer of layers) {
        if (layer.getSource && layer.getSource().getTileCache) {
          cogSource = layer.getSource();
          break;
        }
      }
    }
    
    if (!cogSource || !cogSource.getTileCache) return false;
    
    const cache = cogSource.getTileCache();
    const currentCount = cache.getCount();
    
    return currentCount !== prevCount || currentCount > 0;
  }, { timeout: 10000 }, beforeCache);
  
  const tileLoadTime = await page.evaluate(() => performance.now());
  
  await page.waitForTimeout(500);
  const renderCompleteTime = await page.evaluate(() => performance.now());
  
  return {
    zoomDuration: zoomCompleteTime - startTime,
    tileLoadTime: tileLoadTime - zoomCompleteTime,
    renderDuration: renderCompleteTime - tileLoadTime,
    totalDuration: renderCompleteTime - startTime
  };
}
