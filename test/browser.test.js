import puppeteer from 'puppeteer';
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;


describe('renders without crashing', () => {
    test('we view the welcome h1 header', async () => {
        debugger;
        const width = 1535;
        const height = 1704;
        let args = [];
        args.push('--no-sandbox');
        let browser =  await puppeteer.launch({ headless: false, ignoreDefaultArgs: ['--disable-extensions'], args});
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98');
        await page.setViewport({ width, height })

        await page.goto('https://mvallet91.github.io/hidden_workbench/');
        expect(page).not.toBeNull();

        // browser.close();
    }, 10000 );
});
