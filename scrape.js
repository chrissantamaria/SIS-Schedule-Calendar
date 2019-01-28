const program = require('commander');
program
    .option('--login', 'automatically logs into SIS using login details from creds.json')
    .option('--headless', 'hides automated Chrome window')
    .option('--weeks <n>', 'specifies how many weeks in advance the program should scrape')
    .parse(process.argv);

const puppeteer = require('puppeteer');
const Json2csvParser = require('json2csv').Parser;
const fs = require('fs-extra');
const creds = require('./creds.json');

(async () => {
    const browser = await puppeteer.launch({ headless: !!program.headless });
    try {
        const page = await browser.newPage();
        // Logging page.evaluate logs to main Node log
        page.on('console', msgs => {
            msgs.args().forEach((msg, i) => {
                console.log(`${i}: ${msg}`);
            });
        });

        const waitFor = timeToWait => new Promise(resolve => setTimeout(() => resolve(), timeToWait));

        console.log('Going to SIS')
        await page.goto('http://www.virginia.edu/sis/');
        // Waiting until login button is loaded
        await page.waitForSelector(`[name='Netbadge']`);
        await page.click(`[name='Netbadge']`);

        // Waiting for next login button
        // (.bg-white is unique enough)
        await page.waitForSelector(`.bg-white`);
        console.log('Got to login');

        await page.click(`#user`);
        if (program.login) {
            await page.keyboard.type(creds.user);
            await page.click(`#pass`);
            await page.keyboard.type(creds.pass);
            await page.click(`.bg-white`);
        }

        // Waiting for main SIS page to load before going to next page (ensuring browser is properly authenticated)
        // If two-step is required, headless mode can be turned off to select the desired auth method. The script will still wait for a succesful login.
        await page.waitForSelector('#SIS_Image', { timeout: 0 });
        console.log('Authentication successful, loading calendar');
        // Going to calendar page for scraping
        // This page is normally an iframe on the main SIS page, but it must be accessed directly to scrape
        await page.goto('https://sisuvacs.admin.virginia.edu/psc/csprd/EMPLOYEE/PSFT_HR_CSPRD/c/SA_LEARNER_SERVICES.SSR_SSENRL_SCHD_W.GBL');
        // Waiting for "Schedule" header to show a successful page load
        await page.waitForSelector(`[id='win0divSSR_DUMMY_RECGP\$0']`);
        // Show intructor button
        await page.click(`#win0divDERIVED_CLASS_S_SHOW_INSTR [type='checkbox']`);
        // Show class name button
        await page.click(`#win0divDERIVED_CLASS_S_SSR_DISP_TITLE [type='checkbox']`);
        // Refresh calendar button
        await page.click(`[id='win0divDERIVED_CLASS_S_SSR_REFRESH_CAL\$38\$'] [type]`);
        await waitFor(3000);
        // Adding JQuery and moment.js to calendar page for easier scraping
        await page.addScriptTag({ path: require.resolve('jquery') });
        await page.addScriptTag({ path: require.resolve('moment') });

        const getClasses = () => {
            let weekStartDate = moment($(`#win0divDERIVED_CLASS_S_START_DT [type]`)[0].value, 'MM/DD/YYYY');
            while (weekStartDate.weekday() != 1) {
                weekStartDate.subtract(1, 'day');
            }
            weekStartDate = weekStartDate.toDate();

            const rows = $(`[id='win0divDERIVED_CLASS_S_HTMLAREA\$0'] tbody`)[0].children;
            const classes = [];
            const columnPositons = [...rows[0].children].slice(1).map(header => header.getBoundingClientRect().x);
            [...rows].slice(1).forEach(row => {
                let cells = [...row.children];
                if (cells[0].getAttribute('scope') == 'row') cells = cells.slice(1);
                cells.forEach(cell => {
                    if (cell.innerHTML != '&nbsp;') {
                        const posX = cell.getBoundingClientRect().x;
                        const colNum = columnPositons.findIndex(col => col == posX);
                        const cellContents = cell.children[0].innerHTML.split('<br>');
                        const times = cellContents[3].split(' - ').map(time => moment(time, 'h:mma').format('h:mm A'));
                        classes.push({
                            name: `${cellContents[1]} (${cellContents[2]})`,
                            description: `${cellContents[0]}${cellContents[6] ? '\n' + cellContents[6] : ''}`,
                            location: cellContents[4],
                            date: moment(weekStartDate).add(colNum, 'd').format('MM/DD/YYYY'),
                            startTime: times[0],
                            endTime: times[1]
                        });
                    }
                });
            });
            return classes;
        };

        let classes = [];
        let i = 1;
        while (i < (program.weeks || 1)) {
            console.log(`Scraping week ${i} of ${program.weeks || 1}`);
            classes = classes.concat(await page.evaluate(getClasses));
            // Next week button
            await page.click('#win0divDERIVED_CLASS_S_SSR_NEXT_WEEK [type]');
            await waitFor(5000);
            i++;
        }
        console.log(`Scraping week ${i} of ${program.weeks || 1}`);
        classes = classes.concat(await page.evaluate(getClasses));

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
        await fs.writeFile('classes.csv', csv)
            .catch(e => { throw new Error(`CSV write error:\n${e}`); });
    } catch (e) {
        throw e;
    } finally {
        browser.close();
    }
})().catch(e => console.error(e)); 