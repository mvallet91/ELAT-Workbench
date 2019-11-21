import puppeteer from 'puppeteer';
jasmine.DEFAULT_TIMEOUT_INTERVAL = 10000;

function PromiseTimeout(delay) {
    return new Promise(function (resolve, reject) {
        setTimeout(resolve, delay);
    });
}

let metadataPath = "C:/Users/manuelvalletor/ELAT-Metadata/FP101x-3T2015/";
let logPath = "C:/Users/manuelvalletor/surfdrive/Shared/WIS-EdX/logs/";

describe('Full End-to-end testing with multiple log files', () => {
    test('Verify the summarized info in dashboard tables', async () => {
        debugger;
        const width = 1535;
        const height = 1704;
        let args = [];
        args.push('--no-sandbox');
        let browser =  await puppeteer.launch({ headless: true, ignoreDefaultArgs: ['--disable-extensions'], args});
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98');
        await page.setViewport({ width, height });

        // await page.goto('https://mvallet91.github.io/hidden_workbench/', {waitUntil: 'domcontentloaded'});
        // await page.goto('http://localhost:63342/untitled/index.html?_ijt=tukl913ue6lo8rkkrp7t1r7huu', {waitUntil: 'domcontentloaded'});
        await page.goto('http://localhost:63342/untitled/index.html?_ijt=d35fu1dqfq7a5l1ttr9g2cc3fk', {waitUntil: 'domcontentloaded'});
        await page.screenshot({path: 'img/screenshot.png'});

        expect(page).not.toBeNull();

        page.on('error', err=> {
            console.log('error happen at the page: ', err);
        });
        page.on('pageerror', pageerr=> {
            console.log('pageerror occurred: ', pageerr);
        });

        await PromiseTimeout(6000);
        const title = await page.title();
        console.log(title);
        await page.screenshot({path: 'test/images/start.png'});

        let selector = '#buttons > button:nth-child(1)';
        await page.evaluate((selector) => document.querySelector(selector).click(), selector);

        let fileNames = ["DelftX-FP101x-3T2015-course_structure-prod-analytics.json",
            "DelftX-FP101x-3T2015-prod.mongo", "DelftX-FP101x-3T2015-auth_user-prod-analytics.sql" ,
            "DelftX-FP101x-3T2015-auth_userprofile-prod-analytics.sql", "DelftX-FP101x-3T2015-student_courseenrollment-prod-analytics.sql",
            "DelftX-FP101x-3T2015-certificates_generatedcertificate-prod-analytics.sql"];
        let filePaths = [];
        for (let file of fileNames){
            filePaths.push(metadataPath + file)
        }
        const [fileChooser] = await Promise.all([
            page.waitForFileChooser(),
            page.click('#filesInput'),
        ]);
        await fileChooser.accept(filePaths);
        await PromiseTimeout(60000);
        await page.screenshot({path: 'test/images/uploadedMeta.png'});

        await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
        await PromiseTimeout(20000);
        await page.screenshot({path: 'processedMeta.png'});

        await page.evaluate((selector) => document.querySelector(selector).click(), selector);

        let logPaths = [];
        for (let day = 15; day < 18; day++) {
            let logName = "delftx-edx-events-2015-10-" + day + ".log.gz";
            logPaths.push(logPath + logName)
        }
        console.log(logPaths);

        const [logfileChooser] = await Promise.all([
            page.waitForFileChooser(),
            page.click('#logFilesInput'),
        ]);
        await logfileChooser.accept(logPaths);
        await PromiseTimeout(300000);
        await page.screenshot({path: 'test/images/uploadedLogs.png'});

        await page.reload({ waitUntil: ["networkidle0", "domcontentloaded"] });
        await PromiseTimeout(300000);
        await page.screenshot({path: 'test/images/processedCharts.png', fullPage: true});

        const data = await page.$$eval('table tr td', tds => tds.map((td) => {
            return td.innerHTML;
        }));
        console.log(data);

        let verification = [ 'Introduction to Functional Programming', 'Thu, October 15, 2015', 'Tue, January 5, 2016', '20,559', '19', '39',
            'Introduction to Functional Programming', '30,077', '5,538', '4,064', '27,544', '7,801',  '7,801', '2,547', '0.06', '79.50',
            'Verified: 281<br>Honor: 862<br>Audit: 0<br>', 'Verified: 81.7<br>Honor: 78.8<br>Audit: undefined<br>', '19.16 minutes', '3,583' ];

        expect(data).toStrictEqual(verification);

        browser.close();
    }, 700000 );
});
