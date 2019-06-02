# SIS-Schedule-Calendar

Schedule parser for University of Virginia's SIS which exports a .csv calendar file for importing into a service like Google Calendar.

## Installation

```bash
npm install
```

## Usage

```bash
npm start
```
The Chrome instance will automatically navigate to the SIS NetBadge login page where credentials will be entered. If two-step verification is required, it will wait for full authentication.

### Valid CLI arguments:
Argument | Default | Description
--- | --- | ---
`--weeks <n>` | `3` | specifies how many weeks in advance the program should scrape
`--out [path]` | `classes.csv` | output path for csv file
`--login` || automatically logs into SIS using login details from creds.json (see `creds_example.json`)
`--headless` || hides automated Chrome window
`-h`, `--help` || output usage information

## Disclaimer

This project is solely intended to be a proof-of-concept. As it relies on consistent formatting of courses in the SIS schedule view, it can often fail in certain edge cases such as waitlisted courses. Please use this at your own discretion.

Automatic login from a local `creds.json` file is supported, but note that your credentials will be stored in plain text. Do so at your own risk.

If you notice any specific bugs, feel free to submit an issue or make a pull request.
