// =============================================================
// Backend/tests/run-all.js  —  runs every test file, one after another
// =============================================================
//   npm run test:all        (backend must be running in another terminal)
const { spawnSync } = require('child_process');
const files = ['conflict-test.js', 'rules-test.js', 'admin-test.js'];
let failed = 0;
for (const f of files) {
  console.log(`\n===== ${f} =====`);
  const r = spawnSync('node', [`tests/${f}`], { stdio: 'inherit' });
  if (r.status !== 0) failed += 1;
}
console.log(failed === 0 ? '\nEVERY TEST FILE PASSED' : `\n${failed} TEST FILE(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);