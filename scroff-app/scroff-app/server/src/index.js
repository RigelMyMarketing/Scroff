import 'dotenv/config';
import { createApp } from './app.js';
import { ensureSeedAdmin } from '../prisma/seed.js';

const PORT = process.env.PORT || 4000;

await ensureSeedAdmin();

const app = createApp();
app.listen(PORT, () => {
  console.log(`Scroff server listening on http://localhost:${PORT}`);
});
