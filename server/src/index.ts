import { existsSync } from 'node:fs';
import path from 'node:path';
import { createApp } from './app.ts';

const port = Number(process.env.PORT ?? 3000);

// The web app is built into web/dist. In development it does not exist, and Vite serves the UI.
const builtWebDir = path.join(import.meta.dirname, '../../web/dist');
const webDir = existsSync(builtWebDir) ? builtWebDir : undefined;

createApp({ webDir }).listen(port, () => {
  console.log(`Salary Management listening on http://localhost:${port}`);
});
