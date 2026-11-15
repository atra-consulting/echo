// Bundles the backend (REST API and MCP server) into a single file, including
// its dependencies and the text modules, so the Docker image needs no
// node_modules except for the external packages below.
// With --test, bundles the specs instead (run them with "npm run test:server").
import { build } from 'esbuild';
import { cpSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';

// Packages that load files from their own directory at runtime and therefore
// cannot be bundled. They are copied with their dependencies, in the versions
// of package-lock.json, to dist/server/node_modules.
const EXTERNAL = ['@google-cloud/firestore'];

const test = process.argv.includes('--test');
const specs = readdirSync('server', { recursive: true })
    .filter((file) => file.endsWith('.spec.ts'))
    .map((file) => `server/${file}`);
const outdir = test ? 'dist/server-test' : 'dist/server';
rmSync(outdir, { recursive: true, force: true });

await build({
    entryPoints: test ? specs : ['server/main.ts'],
    outdir: outdir,
    outbase: 'server',
    outExtension: { '.js': '.cjs' },
    bundle: true,
    platform: 'node',
    target: 'node22',
    format: 'cjs',
    sourcemap: true,
    external: EXTERNAL,
    logLevel: 'warning',
});

// The specs resolve the external packages from the node_modules of the repository.
if (!test) {
    copyRuntimeDependencies(join(outdir, 'node_modules'));
}

function copyRuntimeDependencies(target) {
    const packages = JSON.parse(readFileSync('package-lock.json', 'utf8')).packages;
    // Node's resolution: the nearest node_modules up from the requiring package.
    const resolve = (from, name) => {
        for (let base = from; ;) {
            if (packages[`${base}/node_modules/${name}`]) {
                return `${base}/node_modules/${name}`;
            }
            const parent = base.lastIndexOf('/node_modules/');
            if (parent < 0) {
                return packages[`node_modules/${name}`] ? `node_modules/${name}` : undefined;
            }
            base = base.slice(0, parent);
        }
    };
    const closure = new Set();
    const visit = (path) => {
        if (closure.has(path)) {
            return;
        }
        closure.add(path);
        const meta = packages[path];
        for (const name of Object.keys({ ...meta.dependencies, ...meta.optionalDependencies })) {
            const dependency = resolve(path, name);
            if (dependency) {
                visit(dependency);
            }
        }
    };
    EXTERNAL.forEach((name) => visit(`node_modules/${name}`));

    for (const path of closure) {
        // Nested node_modules are part of the closure themselves, if needed.
        cpSync(path, join(target, path.slice('node_modules/'.length)), {
            recursive: true,
            dereference: true,
            filter: (source) => !source.startsWith(`${path}/node_modules`),
        });
    }
}
