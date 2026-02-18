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
    
    expect(metrics.totalDuration).toBeLessThan(5000);
    expect(metrics.fps.avg).toBeGreaterThan(15);
  });

  test('수평 이동 (Pan Left) 성능 측정', async ({ page }) => {
    await measurePan(page, 'right', 200);
    await page.waitForTimeout(500);

    const metrics = await measurePan(page, 'left', 200);

    console.log('\n=== 수평 이동 (왼쪽) 성능 ===');
    console.log(`총 소요 시간: ${metrics.totalDuration.toFixed(2)}ms`);
    console.log(`평균 FPS: ${metrics.fps.avg}`);

    expect(metrics.totalDuration).toBeLessThan(5000);
    expect(metrics.fps.avg).toBeGreaterThan(15);
  });

  test('수직 이동 (Pan Down) 성능 측정', async ({ page }) => {
    const metrics = await measurePan(page, 'down', 300);

    console.log('\n=== 수직 이동 (아래) 성능 ===');
    console.log(`총 소요 시간: ${metrics.totalDuration.toFixed(2)}ms`);
    console.log(`평균 FPS: ${metrics.fps.avg}`);

    expect(metrics.totalDuration).toBeLessThan(5000);
    expect(metrics.fps.avg).toBeGreaterThan(15);
  });

  test('수직 이동 (Pan Up) 성능 측정', async ({ page }) => {
    await measurePan(page, 'down', 200);
    await page.waitForTimeout(500);

    const metrics = await measurePan(page, 'up', 200);

    console.log('\n=== 수직 이동 (위) 성능 ===');
    console.log(`총 소요 시간: ${metrics.totalDuration.toFixed(2)}ms`);
    console.log(`평균 FPS: ${metrics.fps.avg}`);

    expect(metrics.totalDuration).toBeLessThan(5000);
  });

  test('대각선 이동 성능 측정', async ({ page }) => {
    const metrics = await measurePan(page, 'diagonal', 300, 300);

    console.log('\n=== 대각선 이동 성능 ===');
    console.log(`총 소요 시간: ${metrics.totalDuration.toFixed(2)}ms`);
    console.log(`평균 FPS: ${metrics.fps.avg}`);

    expect(metrics.totalDuration).toBeLessThan(6000);
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
  
  // FPS 측정 시작 - window에 데이터 저장
  await page.evaluate(() => {
    window.__fpsData = [];
    window.__fpsLastTime = performance.now();
    window.__fpsFrameCount = 0;
    window.__fpsMeasuring = true;

    function countFrame() {
      if (!window.__fpsMeasuring) return;
      const now = performance.now();
      const delta = now - window.__fpsLastTime;
      if (delta >= 100) {
        window.__fpsData.push(Math.round((window.__fpsFrameCount * 1000) / delta));
        window.__fpsFrameCount = 0;
        window.__fpsLastTime = now;
      }
      window.__fpsFrameCount++;
      requestAnimationFrame(countFrame);
    }
    requestAnimationFrame(countFrame);
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
    window.__fpsMeasuring = false;
    return window.__fpsData || [];
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
