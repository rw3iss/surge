#!/usr/bin/env node
/**
 * `npm create sitesurge` — scaffold a new SiteSurge CMS project.
 *
 * Generates a turnkey Docker Compose project (Postgres + Redis + the SiteSurge
 * server) with a ready `.env`, and — with `--headless` — a starter frontend that
 * pulls content via @sitesurge/client. Zero runtime deps for a fast create.
 *
 *   npm create sitesurge@latest my-site
 *   npm create sitesurge@latest my-site -- --headless
 */
import { randomBytes, } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, writeFileSync, } from 'node:fs';
import { createInterface, } from 'node:readline';
import path from 'node:path';

const args = process.argv.slice(2,);
const headless = args.includes('--headless',);
let target = args.find((a: string,) => !a.startsWith('-',),);

function ask(q: string, def: string,): Promise<string> {
    const rl = createInterface({ input: process.stdin, output: process.stdout, },);
    return new Promise((resolve,) => rl.question(`${q} (${def}) `, (a: string,) => { rl.close(); resolve(a.trim() || def,); },),);
}
const secret = (n = 24,) => randomBytes(n,).toString('base64url',);
const write = (dir: string, rel: string, content: string,) => {
    const p = path.join(dir, rel,);
    mkdirSync(path.dirname(p,), { recursive: true, },);
    writeFileSync(p, content,);
};

const COMPOSE = `# Turnkey SiteSurge stack. First run:  docker compose up -d
# then open http://localhost:3001/setup  (or: docker compose exec server sitesurge setup --from-env)
name: __NAME__

services:
  postgres:
    image: postgres:18-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: \${DB_NAME}
      POSTGRES_USER: \${DB_USER}
      POSTGRES_PASSWORD: \${DB_PASSWORD}
    volumes: [postgres_data:/var/lib/postgresql/data]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \${DB_USER}"]
      interval: 5s
      timeout: 3s
      retries: 20

  redis:
    image: redis:7-alpine
    restart: unless-stopped
    volumes: [redis_data:/data]

  server:
    # Build the image from the SiteSurge repo, or use a published image once
    # available:  image: sitesurge/server:latest
    image: sitesurge/server:latest
    restart: unless-stopped
    ports: ["\${PORT}:3001"]
    depends_on:
      postgres: { condition: service_healthy }
      redis: { condition: service_started }
    env_file: [.env]
    environment:
      DATABASE_URL: postgresql://\${DB_USER}:\${DB_PASSWORD}@postgres:5432/\${DB_NAME}
      REDIS_URL: redis://redis:6379
    volumes:
      - uploads:/app/packages/api/uploads
      - data:/app/packages/api/data

volumes: { postgres_data: {}, redis_data: {}, uploads: {}, data: {} }
`;

const ENV = `# SiteSurge — turnkey config. CHANGE JWT_SECRET stays secret.
NODE_ENV=production
PORT=3001
DB_NAME=__NAME__
DB_USER=__NAME__
DB_PASSWORD=__DBPASS__
JWT_SECRET=__JWT__
FRONTEND_URL=http://localhost:3001
CORS_ORIGINS=http://localhost:3001
# For non-interactive setup (docker compose exec server sitesurge setup --from-env):
SITE_NAME=__TITLE__
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=__ADMINPASS__
`;

const GITIGNORE = `.env\nnode_modules\ndist\n`;

const README = (name: string,) =>
    `# ${name}

A [SiteSurge CMS](https://github.com/rw3iss/surge-cms) site.

## Run (Docker, turnkey)

\`\`\`bash
docker compose up -d
# first run — create the admin + schema, either:
open http://localhost:3001/setup                              # visual wizard
# or non-interactively from the generated .env:
docker compose exec server sitesurge setup --from-env
\`\`\`

Admin at \`/admin\`. The server serves the API, the public site, and the admin UI.
Config lives in \`.env\` — **keep \`JWT_SECRET\` secret**.

> The compose file expects the \`sitesurge/server\` image. Until it's on a
> registry, build it from the SiteSurge repo:
> \`docker build -f config/Dockerfile -t sitesurge/server:latest .\`

## Prefer native (no Docker)?

Run the server on any host with Node + Postgres — see the SiteSurge
\`docs/DEPLOYMENT.md\` (systemd + \`node dist\`), and \`sitesurge setup\`.
${headless
        ? `
## Headless frontend

\`frontend/\` is a starter that pulls content via \`@sitesurge/client\`:

\`\`\`bash
cd frontend && npm i && npm start
\`\`\`
`
        : ''}`;

const HEADLESS_PKG = `{
  "name": "__NAME__-frontend",
  "private": true,
  "type": "module",
  "scripts": { "start": "node --experimental-strip-types src/index.ts" },
  "dependencies": { "@sitesurge/client": "^0.2.0", "@sitesurge/types": "^0.1.0" }
}
`;
const HEADLESS_SRC = `import { createClient } from '@sitesurge/client';

// Point at your running SiteSurge server; issue a key in admin → Settings → API Keys.
const cms = createClient({
  baseUrl: process.env.CMS_URL ?? 'http://localhost:3001',
  auth: process.env.CMS_KEY ? { apiKey: process.env.CMS_KEY } : { mode: 'cookie' },
});

const { data: posts } = await cms.posts.list({ limit: 10 });
for (const p of posts) console.log('-', p.title);
`;

async function main() {
    console.log('\\n  create-sitesurge — new SiteSurge project\\n',);
    if (!target) target = await ask('Project directory', 'my-sitesurge-site',);
    const dir = path.resolve(process.cwd(), target,);
    const name = path.basename(dir,).toLowerCase().replace(/[^a-z0-9-]/g, '-',) || 'sitesurge';

    if (existsSync(dir,) && readdirSync(dir,).length > 0) {
        console.error(`  ✗ ${dir} exists and is not empty. Choose an empty directory.`,);
        process.exit(1,);
    }

    const title = await ask('Site name', 'My Site',);
    const subst = (t: string,) =>
        t.replaceAll('__NAME__', name,)
            .replaceAll('__TITLE__', title,)
            .replaceAll('__DBPASS__', secret(16,),)
            .replaceAll('__ADMINPASS__', secret(12,),)
            .replaceAll('__JWT__', secret(32,),);

    write(dir, 'docker-compose.yml', subst(COMPOSE,),);
    write(dir, '.env', subst(ENV,),);
    write(dir, '.gitignore', GITIGNORE,);
    write(dir, 'README.md', README(title,),);
    if (headless) {
        write(dir, 'frontend/package.json', subst(HEADLESS_PKG,),);
        write(dir, 'frontend/src/index.ts', HEADLESS_SRC,);
    }

    console.log(`  ✓ Scaffolded ${name} in ${dir}\\n`,);
    console.log('  Next:',);
    console.log(`    cd ${target}`,);
    console.log('    docker compose up -d',);
    console.log('    open http://localhost:3001/setup   # or: docker compose exec server sitesurge setup --from-env\\n',);
}

main().catch((e,) => { console.error(e,); process.exit(1,); },);
