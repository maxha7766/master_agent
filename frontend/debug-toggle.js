const puppeteer = require('puppeteer');

(async () => {
  console.log('🔍 Starting toggle switch debug...\n');

  const browser = await puppeteer.launch({
    headless: false, // Show browser for debugging
    defaultViewport: { width: 1920, height: 1080 },
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  });

  const page = await browser.newPage();

  // Capture console messages
  page.on('console', msg => {
    console.log(`[BROWSER CONSOLE ${msg.type()}]:`, msg.text());
  });

  // Capture errors
  page.on('pageerror', error => {
    console.error(`[BROWSER ERROR]:`, error.message);
  });

  try {
    console.log('📍 Navigating to http://localhost:3000/documents...');
    await page.goto('http://localhost:3000/documents', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // Wait a bit for React to hydrate
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Take initial screenshot
    await page.screenshot({ path: '/tmp/documents-page-full.png', fullPage: true });
    console.log('✅ Screenshot saved to /tmp/documents-page-full.png\n');

    // Check if we're on login page or documents page
    const currentUrl = page.url();
    console.log(`📍 Current URL: ${currentUrl}\n`);

    // Look for the Switch component
    console.log('🔎 Checking for Switch component...');
    const switchExists = await page.evaluate(() => {
      const switches = document.querySelectorAll('[role="switch"]');
      return {
        found: switches.length > 0,
        count: switches.length,
        details: Array.from(switches).map(sw => ({
          html: sw.outerHTML,
          visible: sw.offsetWidth > 0 && sw.offsetHeight > 0,
          display: window.getComputedStyle(sw).display,
          visibility: window.getComputedStyle(sw).visibility,
          opacity: window.getComputedStyle(sw).opacity
        }))
      };
    });

    console.log('Switch component search results:', JSON.stringify(switchExists, null, 2));

    // Look for the toggle area by text
    console.log('\n🔎 Checking for "RAG Docs" and "Table Data" text...');
    const toggleText = await page.evaluate(() => {
      const ragText = Array.from(document.querySelectorAll('*')).find(el =>
        el.textContent && el.textContent.includes('RAG Docs')
      );
      const tableText = Array.from(document.querySelectorAll('*')).find(el =>
        el.textContent && el.textContent.includes('Table Data')
      );

      return {
        ragDocsFound: !!ragText,
        ragDocsHTML: ragText ? ragText.outerHTML : null,
        tableDataFound: !!tableText,
        tableDataHTML: tableText ? tableText.outerHTML : null
      };
    });

    console.log('Toggle text search results:', JSON.stringify(toggleText, null, 2));

    // Check for the upload section HTML structure
    console.log('\n🔎 Checking for upload section structure...');
    const uploadSection = await page.evaluate(() => {
      const headings = Array.from(document.querySelectorAll('h2'));
      const uploadHeading = headings.find(h => h.textContent.includes('Upload Document'));

      if (uploadHeading) {
        const card = uploadHeading.closest('[class*="card"]') || uploadHeading.closest('div');
        return {
          found: true,
          html: card ? card.outerHTML.substring(0, 2000) : 'Card not found',
          childrenCount: card ? card.children.length : 0
        };
      }

      return { found: false };
    });

    console.log('Upload section:', JSON.stringify(uploadSection, null, 2));

    // Check for any React errors in the DOM
    console.log('\n🔎 Checking for React errors...');
    const reactErrors = await page.evaluate(() => {
      const errors = Array.from(document.querySelectorAll('[class*="error"]'));
      return errors.map(err => ({
        text: err.textContent,
        html: err.outerHTML.substring(0, 500)
      }));
    });

    console.log('React errors:', reactErrors.length > 0 ? JSON.stringify(reactErrors, null, 2) : 'None found');

    // Get the full HTML of the upload card
    console.log('\n📄 Getting full HTML of upload card...');
    const cardHTML = await page.evaluate(() => {
      const heading = Array.from(document.querySelectorAll('h2')).find(h =>
        h.textContent.includes('Upload Document')
      );
      if (heading) {
        const card = heading.closest('[class*="card"]') || heading.closest('div');
        return card ? card.innerHTML : null;
      }
      return null;
    });

    if (cardHTML) {
      console.log('Upload card HTML (first 3000 chars):\n', cardHTML.substring(0, 3000));
    } else {
      console.log('Upload card not found');
    }

    // Take a screenshot of just the upload section
    const uploadCard = await page.$('h2::-p-text(Upload Document)');
    if (uploadCard) {
      const cardElement = await uploadCard.evaluateHandle(el => el.closest('[class*="card"]') || el.closest('div'));
      if (cardElement) {
        await cardElement.screenshot({ path: '/tmp/upload-card.png' });
        console.log('\n✅ Upload card screenshot saved to /tmp/upload-card.png');
      }
    }

    console.log('\n✅ Debug complete! Check screenshots and logs above.');

  } catch (error) {
    console.error('❌ Error during debug:', error);
  } finally {
    // Keep browser open for 10 seconds to allow manual inspection
    console.log('\n⏳ Browser will stay open for 10 seconds for manual inspection...');
    await new Promise(resolve => setTimeout(resolve, 10000));
    await browser.close();
  }
})();
