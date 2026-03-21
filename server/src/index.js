import { config } from './config/env.js';
import './config/database.js';
import app from './app.js';

app.listen(config.port, () => {
  console.log(`VoiceIQ server running on port ${config.port}`);
  console.log(`Database initialized at ${config.databasePath}`);
});
