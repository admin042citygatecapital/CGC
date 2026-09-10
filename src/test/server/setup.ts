import os from 'node:os';
import path from 'node:path';

process.env.PRIVATE_DATA_ROOT ??= path.join(os.tmpdir(), `city-gate-capital-tests-${process.pid}`);
