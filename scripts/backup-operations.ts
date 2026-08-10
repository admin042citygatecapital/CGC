import { closeConnection } from '../src/server/db/db.js';
import { createOperationalBackup } from '../src/server/lib/operationalBackup.js';

createOperationalBackup()
  .then(result => console.log(JSON.stringify({ ok: true, ...result })))
  .catch(error => { console.error(JSON.stringify({ ok: false, error: String(error) })); process.exitCode = 1; })
  .finally(() => closeConnection());
