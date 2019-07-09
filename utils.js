// Promise-based wait for SIS page loads (loading icon in corner)
const waitForSISLoad = () => new Promise(resolve => {
    // Checks every 300ms if the loading icon is visible
    const loop = setInterval(() => {
        const { visibility } = document.querySelector('#WAIT_win0').style;
        if (visibility === 'hidden') {
            clearInterval(loop);
            resolve();
        }
    }, 300);
});

// Grabs courses for displayed week
const getClasses = () => {
    const classes = [];

    // Storing starting day of the given week (Monday)
    // so that dates of classes can be calculated relative to it later
    const weekStartDate = new Date(document.querySelector('#DERIVED_CLASS_S_START_DT').value);

    // Using spread to use HTMLCollection as an array
    // Excluding first row (table header)
    const rows = [
        ...document.querySelectorAll(
            `[id='win0divDERIVED_CLASS_S_HTMLAREA$0'] tbody`
        )[0].children
    ].slice(1);
    // Getting x coordinate positions of each row (janky but best way to later get column number of a cell)
    const columnPositons = [...rows[0].children].map(header => header.getBoundingClientRect().x);

    for (const row of rows) {
        let cells = [...row.children]
            // Using only cells which are classes (specific background color)
            .filter(cell => cell.innerHTML.includes('background-color:rgb(182,209,146)'));

        for (const cell of cells) {
            const posX = cell.getBoundingClientRect().x;
            // Getting the cell's column number based on the
            // previously calculated positions of each column (starts at 0)
            const colNum = columnPositons.findIndex(col => col == posX) - 1;

            const cellContents = cell.children[0].innerHTML.split('<br>');
            // Splitting times line and reformatting as valid time string for csv
            const times = cellContents[3]
                .split(' - ')
                .map(time => moment(time, 'h:mma').format('h:mm A'));

            classes.push({
                // Course name (class type)
                name: `${cellContents[1]} (${cellContents[2]})`,
                // Course number
                // Instructor (if present)
                description: `
                            ${cellContents[0]}
                            ${cellContents[6] ? '\n' + cellContents[6] : ''}
                        `,
                location: cellContents[4],
                date: moment(weekStartDate).add(colNum, 'd').format('MM/DD/YYYY'),
                startTime: times[0],
                endTime: times[1]
            });
        }
    }
    return classes;
};

module.exports = {
    waitForSISLoad,
    getClasses
};