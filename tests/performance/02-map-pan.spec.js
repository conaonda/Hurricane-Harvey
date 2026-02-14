import { test, expect } from '@playwright/test';

test.describe('지도 이동 (Pan) 성능 측정', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
      const loadingEl = document.getElementById('loading');
      return loadingEl && !loadingEl.classList.contains('active');
    }, { timeout: 30000 });
    
    await page.waitForTimeout(2000);
  });
  
  test('수평 이동 (Pan Right) 성능 측정', async ({ page }) => {
    const metrics = await measurePan(page, 'right', 300);
    
    console.log('\n=== 수평 이동 (오른쪽) 성능 ===');
    console.log(`드래그 소요: ${metrics.dragDuration.toFixed(2)}ms`);
    console.log(`렌더링 소요: ${metrics.renderDuration.toFixed(2)}ms`);
    console.log(`총 소요 시간: ${metrics.totalDuration.toFixed(2)}ms`);
    console.log(`평균 FPS: ${metrics.fps.avg}`);
    console.log(`최소 FPS: ${metrics.fps.min}`);
    console.log(`최대 FPS: ${metrics.fps.max}`);
    
    expect(metrics.totalDuration).toBeLessThan(2000);
    expect(metrics.fps.avg).toBeGreaterThan(30);
  });
  
  test('수평 이동 (Pan Left) 성능 측정', async ({ page }) => {
    await measurePan(page, 'right', 200);
    await page.waitForTimeout(500);
    
    const metrics = await measurePan(page, 'left', 200);
    
    console.log('\n=== 수평 이동 (왼쪽) 성능 ===');
    console.log(`총 소요 시간: ${metrics.totalDuration.toFixed(2)}ms`);
    console.log(`평균 FPS: ${metrics.fps.avg}`);
    
    expect(metrics.totalDuration).toBeLessThan(2000);
    expect(metrics.fps.avg).toBeGreaterThan(30);
  });
  
  test('수직 이동 (Pan Down) 성능 측정', async ({ page }) => {
    const metrics = await measurePan(page, 'down', 300);
    
    console.log('\n=== 수직 이동 (아래) 성능 ===');
    console.log(`총 소요 시간: ${metrics.totalDuration.toFixed(2)}ms`);
    console.log(`평균 FPS: ${metrics.fps.avg}`);
    
    expect(metrics.totalDuration).toBeLessThan(2000);
    expect(metrics.fps.avg).toBeGreaterThan(30);
  });
  
  test('수직 이동 (Pan Up) 성능 측정', async ({ page }) => {
    await measurePan(page, 'down', 200);
    await page.waitForTimeout(500);
    
    const metrics = await measurePan(page, 'up', 200);
    
    console.log('\n=== 수직 이동 (위) 성능 ===');
    console.log(`총 소요 시간: ${metrics.totalDuration.toFixed(2)}ms`);
    console.log(`평균 FPS: ${metrics.fps.avg}`);
    
    expect(metrics.totalDuration).toBeLessThan(2000);
  });
  
  test('대각선 이동 성능 측정', async ({ page }) => {
    const metrics = await measurePan(page, 'diagonal', 300, 300);
    
    console.log('\n=== 대각선 이동 성능 ===');
    console.log(`총 소요 시간: ${metrics.totalDuration.toFixed(2)}ms`);
    console.log(`평균 FPS: ${metrics.fps.avg}`);
    
    expect(metrics.totalDuration).toBeLessThan(2500);
  });
  
  test('이동 성능 일관성 테스트 (10회 반복)', async ({ page }) => {
    const results = [];
    
    for (let i = 0; i < 10; i++) {
      const metrics = await measurePan(page, 'right', 200);
      results.push(metrics.totalDuration);
      
      await measurePan(page, 'left', 200);
      await page.waitForTimeout(500);
    }
    
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const min = Math.min(...results);
    const max = Math.max(...results);
    const variance = results.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / results.length;
    const stdDev = Math.sqrt(variance);
    
    console.log('\n=== 일관성 테스트 결과 (10회) ===');
    console.log(`평균: ${avg.toFixed(2)}ms`);
    console.log(`최소: ${min.toFixed(2)}ms`);
    console.log(`최대: ${max.toFixed(2)}ms`);
    console.log(`표준편차: ${stdDev.toFixed(2)}ms`);
    console.log(`변동계수: ${(stdDev / avg * 100).toFixed(2)}%`);
    
    expect(stdDev / avg).toBeLessThan(0.3);
  });
});

async function measurePan(page, direction, distance, distanceY = 0) {
  const viewport = page.viewportSize();
  const centerX = viewport ? viewport.width / 2 : 400;
  const centerY = viewport ? viewport.height / 2 : 300;
  
  let endX = centerX;
  let endY = centerY;
  
  switch (direction) {
    case 'right':
      endX += distance;
      break;
    case 'left':
      endX -= distance;
      break;
    case 'down':
      endY += distance;
      break;
    case 'up':
      endY -= distance;
      break;
    case 'diagonal':
      endX += distance;
      endY += distanceY;
      break;
  }
  
  const fpsPromise = page.evaluate(() => {
    return new Promise((resolve) => {
      const fpsData = [];
      let lastTime = performance.now();
      let frameCount = 0;
      let isMeasuring = true;
      
      function countFrame() {
        if (!isMeasuring) {
          resolve(fpsData);
          return;
        }
        
        const now = performance.now();
        const delta = now - lastTime;
        
        if (delta >= 100) {
          const fps = Math.round((frameCount * 1000) / delta);
          fpsData.push(fps);
          frameCount = 0;
          lastTime = now;
        }
        
        frameCount++;
        requestAnimationFrame(countFrame);
      }
      
      requestAnimationFrame(countFrame);
      
      window.stopFPSMeasurement = () => {
        isMeasuring = false;
      };
    });
  });
  
  const startTime = await page.evaluate(() => performance.now());
  
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  
  const steps = 20;
  for (let i = 1; i <= steps; i++) {
    const x = centerX + (endX - centerX) * (i / steps);
    const y = centerY + (endY - centerY) * (i / steps);
    await page.mouse.move(x, y);
    await page.waitForTimeout(16);
  }
  
  await page.mouse.up();
  const endTime = await page.evaluate(() => performance.now());
  
  await page.waitForTimeout(1000);
  const renderCompleteTime = await page.evaluate(() => performance.now());
  
  const fpsData = await page.evaluate(() => {
    window.stopFPSMeasurement();
    return new Promise(resolve => {
      setTimeout(() => {
        resolve(window.fpsData || []);
      }, 200);
    });
  });
  
  return {
    dragDuration: endTime - startTime,
    renderDuration: renderCompleteTime - endTime,
    totalDuration: renderCompleteTime - startTime,
    fps: {
      data: fpsData,
      avg: fpsData.length > 0 ? 
        Math.round(fpsData.reduce((a, b) => a + b, 0) / fpsData.length) : 0,
      min: fpsData.length > 0 ? Math.min(...fpsData) : 0,
      max: fpsData.length > 0 ? Math.max(...fpsData) : 0
    }
  };
}
