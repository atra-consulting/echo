// Bundles the MCP server into a single file, including its dependencies and
// the text modules, so the Docker image needs no node_modules.
// With --test, bundles the specs instead (run them with "npm run test:mcp").
import { build } from 'esbuild';
import { readdirSync } from 'node:fs';

const test = process.argv.includes('--test');
const specs = readdirSync('mcp').filter((file) => file.endsWith('.spec.ts')).map((file) => `mcp/${file}`);

await build({
    entryPoints: test ? specs : ['mcp/main.ts'],
    outdir: test ? 'dist/mcp-test' : 'dist/mcp',
    outExtension: { '.js': '.cjs' },
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    sourcemap: true,
    logLevel: 'warning',
});
