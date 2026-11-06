import { createVercelHandler } from '../src/vercelApp.js';

const entryArgument = process.argv[1] || '';
const startedDirectly = entryArgument.endsWith('index.js');

function unavailable(req, res) {
  res.statusCode = 503;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({
    success: false,
    message: 'Production configuration is incomplete.',
    data: null,
    errors: ['Production configuration is incomplete'],
  }));
}

let app;
try {
  app = createVercelHandler(process.env);
} catch (error) {
  console.error(`[Server] ${error.message}`);
  if (startedDirectly) process.exit(1);
  app = unavailable;
}

export default app;
