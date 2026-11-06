import { runProductionInit } from './productionInit.js';

try {
  const result = await runProductionInit(process.env);
  console.log(`[Bootstrap] Target: ${result.target}`);
  console.log(`[Bootstrap] Society: ${result.societyName} (${result.registrationNumber})`);
  console.log(`[Bootstrap] Society ${result.societyCreated ? 'created' : 'already present'}`);
  console.log(`[Bootstrap] Administrator ${result.userCreated ? 'created' : 'already present'}: ${result.adminEmail}`);
  console.log(`[Bootstrap] Role: ${result.adminRole}`);
  console.log(`[Bootstrap] Invitation code: ${result.invitationCode}`);
  if (result.demoCodeRetained) {
    console.log('[Bootstrap] The existing invitation code is the public demo code. It was not changed.');
  }
  console.log('[Bootstrap] No financial records were copied or modified.');
} catch (error) {
  console.error(`[Bootstrap] ${error.message}`);
  process.exit(1);
}
