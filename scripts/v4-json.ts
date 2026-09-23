import { writeFileSync } from 'node:fs';
import { v4Assumptions } from './v4-scenarios';
const dir = process.argv[2];
for (const units of [16, 10] as const) writeFileSync(`${dir}/v4-${units}.json`, JSON.stringify(v4Assumptions({ units })));
