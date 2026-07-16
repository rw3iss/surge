import { describe, expect, it, } from 'vitest';
import { execSync, } from 'node:child_process';
import path from 'node:path';

describe('cache-invalidation contract', () => {
    it('no raw cache.del / cache.delPattern outside cache.ts', () => {
        const srcRoot = path.resolve(__dirname, '../',); // packages/api/src
        let out = '';
        try {
            out = execSync(
                `grep -rn --include='*.ts' -E 'cache\\.(del|delPattern)\\(' ${srcRoot} || true`,
                { encoding: 'utf8', },
            );
        } catch { /* grep exit 1 = no matches */ }
        const offenders = out
            .split('\n',)
            .filter(Boolean,)
            .filter((l,) => !l.includes('/services/cache.ts',))
            // this test file itself references the strings in a regex:
            .filter((l,) => !l.includes('cache-contract.test.ts',));
        expect(offenders, `raw cache.del/delPattern found:\n${offenders.join('\n',)}`,).toEqual([],);
    },);
},);
