const program = require('commander');
program
    .option('--login', 'automatically logs into SIS using login details from creds.json')
    .option('--headless', 'hides automated Chrome window')
    .option('--weeks <n>', 'specifies how many weeks in advance the program should scrape')
    .option('--out [path]', 'output path for csv file')
    .parse(process.argv);

const puppeteer = require('puppeteer');
const Json2csvParser = require('json2csv').Parser;
const fs = require('fs-extra');

const { waitForSISLoad, getClasses } = require("./utils");

(async () => {
    const browser = await puppeteer.launch({
        headless: !!program.headless,
        //  devtools: true 
    });
    try {
        const page = await browser.newPage();
        // Logging page.evaluate logs to main Node log
        page.on('console', msgs => {
            msgs.args().forEach((msg, i) => {
                console.log(`${i}: ${msg}`);
            });
        });

        console.log('Going to SIS');
        await page.goto('http://www.virginia.edu/sis/');
        // Waiting until login button is loaded
        await page.waitForSelector(`[name='Netbadge']`);
        await page.click(`[name='Netbadge']`);

        // Waiting for next login button
        // (.bg-white is unique enough to detect correct page)
        await page.waitForSelector('.bg-white');
        console.log('Got to login, awaiting authentication');

        // Automatically logging in if login flag was used
        if (program.login) {
            const creds = require('./creds.json');

            await page.click('#user');
            await page.keyboard.type(creds.user);
            await page.click('#pass');
            await page.keyboard.type(creds.pass);
            await page.click('.bg-white');
        }

        // Waiting for main SIS page to load before going to next page (ensuring browser is properly authenticated)
        // If two-step is required, headless mode can be turned off to select the desired auth method
        // (the script will still wait for a succesful login)
        await page.waitForSelector('#SIS_Image', { timeout: 0 });
        console.log('Authentication successful, loading calendar');
        // Going to calendar page for scraping
        // This page is normally an iframe on the main SIS page, but it must be accessed directly to scrape
        await page.goto('https://sisuvacs.admin.virginia.edu/psc/csprd/EMPLOYEE/PSFT_HR_CSPRD/c/SA_LEARNER_SERVICES.SSR_SSENRL_SCHD_W.GBL');
        // Waiting for "Schedule" header to show a successful page load
        await page.waitForSelector(`[id='win0divSSR_DUMMY_RECGP$0']`);

        // Adding JQuery and moment.js to calendar page for easier scraping
        await page.addScriptTag({ path: require.resolve('jquery') });
        await page.addScriptTag({ path: require.resolve('moment') });

        // Show intructor button
        await page.click(`#win0divDERIVED_CLASS_S_SHOW_INSTR [type='checkbox']`);
        // Show class name button
        await page.click(`#win0divDERIVED_CLASS_S_SSR_DISP_TITLE [type='checkbox']`);
        // Refresh calendar button
        await page.click(`[id='win0divDERIVED_CLASS_S_SSR_REFRESH_CAL$38$'] [type]`);
        await page.evaluate(waitForSISLoad);

        let classes = [];
        const weeks = program.weeks || 1;
        // Performing scrape for each desired week
        for (let i = 1; i <= weeks; i++) {
            console.log(`Scraping week ${i} of ${weeks}`);
            // Adding newly scraped classes to main classes array
            classes = classes.concat(await page.evaluate(getClasses));
            // Loading next week if necessary
            if (i < weeks) {
                // Next week button
                await page.click('#win0divDERIVED_CLASS_S_SSR_NEXT_WEEK [type]');
                await page.evaluate(waitForSISLoad);
            }
        }

        // Formatting class objects to match csv calendar standard
        const json2csvParser = new Json2csvParser({
            fields: [
                { label: 'Subject', value: 'name' },
                { label: 'Start Date', value: 'date' },
                { label: 'Start Time', value: 'startTime' },
                { label: 'End Date', value: 'date' },
                { label: 'End Time', value: 'endTime' },
                { label: 'Description', value: 'description' },
                { label: 'Location', value: 'location' }
            ]
        });
        const csv = json2csvParser.parse(classes);

        console.log('Writing csv to file');
        await fs.writeFile(program.out || 'classes.csv', csv);

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();