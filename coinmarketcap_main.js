const request = require('request-promise');
const fs = require('fs');
const axios = require('axios');
const chalk = require('chalk');
const config = require("./config.json");
const { plugin } = require('puppeteer-with-fingerprints');

let startTime = null; let totalSuccess = 0; let totalErrors = 0; let proxyIndex = 0;

const THREAD_COUNT = config.THREAD_COUNT;
const RESTART_INTERVAL = config.RESTART_INTERVAL;
const DELAY_BEFORE_CLICK = config.DELAY_BEFORE_CLICK;
const DELAY_BEFORE_CLICK_FAST = config.DELAY_BEFORE_CLICK_FAST;
const DELAY_BETWEEN_THREADS = config.DELAY_BETWEEN_THREADS;

const PAGE_URL = 'https://coinmarketcap.com';

const commands = [
  accessInThreads,
];

async function logSuccess(message) {
  totalSuccess++;
  console.log(chalk.green(`[SUCCESS] ${message}`));
  await updateTotalStats();
}

async function logError(message) {
  totalErrors++;
  console.log(chalk.red(`[ERROR] ${message}`));
  await updateTotalStats();
}

async function updateTotalStats() {
  console.log(chalk.bold(`Total number of successful actions: ${chalk.green(totalSuccess)}`));
  console.log(chalk.bold(`Total errors: ${chalk.red(totalErrors)}`));
  if (startTime) {
    const elapsedTime = calculateElapsedTime();
    console.log(chalk.bold(`Script running time: ${elapsedTime}`));
  }
}

function calculateElapsedTime() {
  const currentTime = new Date();
  const elapsedMilliseconds = currentTime - startTime;
  const hours = Math.floor(elapsedMilliseconds / 3600000);
  const minutes = Math.floor((elapsedMilliseconds % 3600000) / 60000);
  const seconds = Math.floor((elapsedMilliseconds % 60000) / 1000);
  return `${formatTimeUnit(hours)}:${formatTimeUnit(minutes)}:${formatTimeUnit(seconds)}`;
}

function formatTimeUnit(unit) {
  return unit.toString().padStart(2, '0');
}

async function accessStart() {
	try {
		const proxies = fs.readFileSync('proxy.txt', 'utf8').split('\n').filter(Boolean);
		const proxy = proxies[proxyIndex];
		const [ip, port, username, password] = proxy.split(":");
		proxyIndex = (proxyIndex + 1) % proxies.length;
		const fingerprint = await plugin.fetch(config.fingerkey, {
		  tags: ['Chrome'],
		  minBrowserVersion: 117,
		  maxBrowserVersion: 122,
		  screen: {
			  width: 1920,
			  height: 1080
		  },
		})
		plugin.useFingerprint(fingerprint).useProxy(`socks:${ip}:${port}:${username}:${password}`, {
			detectExternalIP: false,
			changeTimezone: true,
			changeGeolocation: true,
		});
		const browser = await plugin.launch({
			headless: false,
		});
		console.log("Browser is open");
		await delay(2000);
		console.log("Delay 2 seconds");
		const page = await browser.newPage();
		console.log("New page has been created");
		await page.goto(PAGE_URL);
	} catch (error) {
		console.error('Error:', error);
		await logError(`Error in performing action: ${error.message}`);
	}
}

async function accessInThreads() {
  for (let i = 0; i < THREAD_COUNT; i++) {
    await accessStart();
    await delay(DELAY_BETWEEN_THREADS);
  }
}

async function executeCommands() {
  for (const command of commands) {
    await command();
  }
}

async function main() {
	if (!startTime) {
		startTime = new Date();
	}
    try {
      await executeCommands();
    } catch (error) {
      console.error('Error during the execution of commands:', error);
    }
    await delay(RESTART_INTERVAL);
    commands.length = 0;
    commands.push(accessInThreads);
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection of the Promise:', promise, 'reason:', reason);
});

try {
	main();
} catch (error) {
  console.error('Error:', error);
}