import { chromium } from '@playwright/test';

async function testLogin() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.createContext();
  const page = await context.newPage();

  try {
    console.log('🧪 Starting login test...');

    // Navigate to login page
    console.log('📄 Navigating to http://localhost:3000/auth/login');
    await page.goto('http://localhost:3000/auth/login', { waitUntil: 'networkidle' });

    console.log(`Current URL: ${page.url()}`);

    // Fill email
    console.log('✍️  Filling email field');
    await page.fill('input[type="email"]', 'admin@test.local');

    // Fill password
    console.log('✍️  Filling password field');
    await page.fill('input[type="password"]', 'ChangeMe#2026');

    // Click submit button
    console.log('🔐 Clicking Sign In button');
    await page.click('button[type="submit"]');

    // Wait for any navigation or redirect
    console.log('⏳ Waiting for page response...');
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {
      console.log('⚠️  Timeout waiting for network idle');
    });

    // Check current URL after login
    const currentUrl = page.url();
    console.log(`📍 After login, current URL: ${currentUrl}`);

    // Check for error messages
    const errorMsg = await page.$('.bg-red-50');
    if (errorMsg) {
      const errorText = await errorMsg.textContent();
      console.log(`❌ Error message displayed: ${errorText}`);
    } else {
      console.log('✅ No error message displayed');
    }

    // Check if redirected to dashboard
    if (currentUrl.includes('/dashboard')) {
      console.log('✅ SUCCESS: Redirected to dashboard!');
      return true;
    } else if (currentUrl.includes('/auth/login')) {
      console.log('❌ PROBLEM: Still on login page, no redirect happened');

      // Check browser console for errors
      page.on('console', msg => {
        if (msg.type() === 'error') {
          console.log(`🔴 Browser error: ${msg.text()}`);
        }
      });

      // Wait a bit longer
      console.log('⏳ Waiting additional 3 seconds...');
      await page.waitForTimeout(3000);

      const finalUrl = page.url();
      console.log(`📍 Final URL after wait: ${finalUrl}`);

      if (finalUrl.includes('/dashboard')) {
        console.log('✅ SUCCESS: Delayed redirect worked!');
        return true;
      } else {
        console.log('❌ STILL NOT REDIRECTED');

        // Try clicking button again
        console.log('🔄 Attempting login again...');
        await page.click('button[type="submit"]');
        await page.waitForTimeout(2000);

        const retryUrl = page.url();
        console.log(`📍 After retry, URL: ${retryUrl}`);

        return retryUrl.includes('/dashboard');
      }
    }

  } catch (error) {
    console.error('🚨 Test error:', error);
    return false;
  } finally {
    await browser.close();
  }
}

// Run the test
testLogin().then(success => {
  if (success) {
    console.log('\n✅ Login test PASSED');
    process.exit(0);
  } else {
    console.log('\n❌ Login test FAILED');
    process.exit(1);
  }
});
