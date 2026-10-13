import fs from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

export function shouldCollect({event, schedule, lastSuccessfulAt, now = Date.now()}) {
  // The primary 00-minute schedule and manual launches always collect.
  if (event !== 'schedule' || schedule !== '17 * * * *') return true;
  const last = Date.parse(lastSuccessfulAt);
  // Moscow has an integer UTC offset: its hour boundary is the same instant.
  const hourStart = Math.floor(now / 3600000) * 3600000;
  return !Number.isFinite(last) || last < hourStart || last > now;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const metadata = JSON.parse(await fs.readFile('data/metadata.json', 'utf8'));
  const run = shouldCollect({event: process.env.GITHUB_EVENT_NAME,
    schedule: process.env.UPDATE_SCHEDULE, lastSuccessfulAt: metadata.lastSuccessfulAt});
  console.log(run ? 'Collect: no successful export this hour, or primary/manual launch.'
    : 'Skip fallback: a successful export already completed this hour.');
  if (process.env.GITHUB_OUTPUT) await fs.appendFile(process.env.GITHUB_OUTPUT, `run=${run}\n`);
}
