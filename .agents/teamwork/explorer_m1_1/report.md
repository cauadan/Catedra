# Relatório de Investigação Técnica — Milestone 1 (Tooling & Monorepo)

**Data**: 2026-10-06  
**Investigador**: explorer_m1_1  
**Escopo**: Estruturação de Ferramental, Workspaces, TypeScript e Scripts do Monorepo  

---

## 1. Visão Geral da Arquitetura do Monorepo

O projeto é estruturado como um monorepo com suporte nativo a **npm workspaces** (compatível com Node.js v24.16.0 e npm 11.13.0 já instalados no ambiente do usuário).

### Divisão de Pacotes
1. **`packages/domain`** (`@estudos/domain`): Biblioteca pura em TypeScript contendo modelos de domínio, esquemas de validação com Zod, funções puras de cálculo de tempo/foco/métricas e validação de invariantes de árvore (prevenção de ciclos, reparenting, propagação em cascata). Zero dependências de I/O, banco de dados ou UI.
2. **`apps/api`** (`@estudos/api`): Backend Node.js com Express, TypeScript, Prisma ORM (PostgreSQL 16), autenticação por sessão em cookies `httpOnly`, middleware de injeção de `user_id`, validação com Zod e tratamento centralizado de erros em português.
3. **`apps/web`** (`@estudos/web`): Frontend SPA construído com React 19, Vite, TypeScript, Tailwind CSS, TanStack Query e Lucide React. Comunica-se com a API via proxy de desenvolvimento no Vite.

---

## 2. Especificação Exata dos Arquivos de Configuração

### 2.1 Raiz do Monorepo (`/`)

#### A. `package.json` (Raiz)
```json
{
  "name": "estudos",
  "version": "0.1.0",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "dev": "concurrently -n \"API,WEB\" -c \"blue,green\" \"npm run dev --workspace=@estudos/api\" \"npm run dev --workspace=@estudos/web\"",
    "dev:api": "npm run dev --workspace=@estudos/api",
    "dev:web": "npm run dev --workspace=@estudos/web",
    "build": "npm run build --workspace=@estudos/domain && npm run build --workspace=@estudos/api && npm run build --workspace=@estudos/web",
    "typecheck": "tsc -b",
    "typecheck:workspaces": "npm run typecheck --workspaces --if-present",
    "test": "vitest run",
    "test:workspaces": "npm run test --workspaces --if-present",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "db:migrate": "npm run prisma:migrate --workspace=@estudos/api",
    "db:generate": "npm run prisma:generate --workspace=@estudos/api"
  },
  "devDependencies": {
    "concurrently": "^9.1.2",
    "typescript": "^5.7.3",
    "vitest": "^3.0.7"
  }
}
```

*Justificativa das bibliotecas adicionadas na raiz:*
- `concurrently`: Utilizado para executar a API e a Web em paralelo via `npm run dev` com prefixos coloridos e saída legível no terminal Windows PowerShell / Bash.
- `vitest`: Permite executar a suíte de testes do monorepo de forma unificada na raiz via `npm test` usando `vitest.workspace.ts`.
- `typescript`: Necessário para o script de raiz `tsc -b` (Project References).

---

#### B. `tsconfig.base.json` (Raiz)
Configurações de compilação universais herdadas por todos os pacotes.
```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2022",
    "moduleDetection": "force",
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true
  }
}
```

---

#### C. `tsconfig.json` (Raiz — Project References)
Configuração de "Solution" para compilação orquestrada com `tsc -b`.
```json
{
  "files": [],
  "references": [
    { "path": "packages/domain" },
    { "path": "apps/api" },
    { "path": "apps/web" }
  ]
}
```

---

#### D. `vitest.workspace.ts` (Raiz)
Orquestração da execução de testes em todos os pacotes.
```ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/domain/vitest.config.ts',
  'apps/api/vitest.config.ts',
  'apps/web/vitest.config.ts'
]);
```

---

#### E. `docker-compose.yml` (Raiz)
Instância PostgreSQL 16 para banco de dados local.
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: estudos_postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: estudos_db
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d estudos_db"]
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
```

---

#### F. `.env.example` (Raiz)
```env
# Banco de Dados (PostgreSQL)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/estudos_db?schema=public"

# Configuração da API
PORT=3001
NODE_ENV=development
CLIENT_URL="http://localhost:5173"
SESSION_SECRET="estudos_dev_session_secret_change_in_production"

# Configuração do Frontend Web
VITE_API_URL="http://localhost:3001"
```

---

#### G. `.gitignore` (Raiz)
```gitignore
node_modules/
dist/
dist-types/
coverage/
*.tsbuildinfo
*.log

# Variáveis de ambiente locais
.env
.env.local
.env.*.local
!.env.example

# Sistema operacional
.DS_Store
Thumbs.db

# Build artifacts
apps/web/dist
apps/api/dist
packages/domain/dist
```

---

### 2.2 Pacote `packages/domain`

#### A. `packages/domain/package.json`
```json
{
  "name": "@estudos/domain",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "import": "./src/index.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "typescript": "^5.7.3",
    "vitest": "^3.0.7"
  }
}
```

#### B. `packages/domain/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "./src",
    "outDir": "./dist",
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

#### C. `packages/domain/vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
```

#### D. Estrutura de Arquivos Inicial de `packages/domain`
- `src/index.ts`: Ponto de exportação central.
- `src/auth/`: Schemas Zod de cadastro, login e usuário.
- `src/tree/`: Schemas e funções puras de árvore (prevenção de ciclo, reparenting).
- `src/formulas/`: Funções puras de cálculo de tempo, aderência, foco e aproveitamento.
- `tests/domain.test.ts`: Teste automatizado inicial garantindo integridade de compilação e teste do pacote.

---

### 2.3 Pacote `apps/api`

#### A. `apps/api/package.json`
```json
{
  "name": "@estudos/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:deploy": "prisma migrate deploy"
  },
  "dependencies": {
    "@estudos/domain": "*",
    "@prisma/client": "^6.4.1",
    "bcrypt": "^5.1.1",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.2",
    "zod": "^3.24.2"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/cookie-parser": "^1.4.8",
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/node": "^22.13.5",
    "@types/supertest": "^6.0.2",
    "prisma": "^6.4.1",
    "supertest": "^7.0.0",
    "tsx": "^4.19.3",
    "typescript": "^5.7.3",
    "vitest": "^3.0.7"
  }
}
```

#### B. `apps/api/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "rootDir": "./src",
    "outDir": "./dist",
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "paths": {
      "@estudos/domain": ["../../packages/domain/src/index.ts"]
    }
  },
  "references": [
    { "path": "../../packages/domain" }
  ],
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests", "prisma"]
}
```

#### C. `apps/api/vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts']
  }
});
```

#### D. Separação Arquitetural do Servidor
- `src/app.ts`: Inicialização da aplicação Express, middlewares de JSON, cookie-parser, CORS, tratamento global de erros em português e rotas. Não inicia escuta na porta HTTP (permite testes unitários rápidos e isolados via `supertest`).
- `src/server.ts`: Ponto de entrada de produção/desenvolvimento que carrega variáveis de ambiente via `dotenv` e inicia `app.listen(PORT)`.

---

### 2.4 Pacote `apps/web`

#### A. `apps/web/package.json`
```json
{
  "name": "@estudos/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@estudos/domain": "*",
    "@tanstack/react-query": "^5.66.9",
    "clsx": "^2.1.1",
    "lucide-react": "^0.475.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "tailwind-merge": "^3.0.1"
  },
  "devDependencies": {
    "@types/node": "^22.13.5",
    "@types/react": "^19.0.10",
    "@types/react-dom": "^19.0.4",
    "@vitejs/plugin-react": "^4.3.4",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.5.3",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.7.3",
    "vite": "^6.2.0",
    "vitest": "^3.0.7"
  }
}
```

#### B. `apps/web/tsconfig.json`
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "composite": true,
    "noEmit": true,
    "tsBuildInfoFile": "./node_modules/.tmp/tsconfig.tsbuildinfo",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@estudos/domain": ["../../packages/domain/src/index.ts"]
    }
  },
  "references": [
    { "path": "../../packages/domain" }
  ],
  "include": ["src/**/*", "vite.config.ts"],
  "exclude": ["node_modules", "dist"]
}
```

#### C. `apps/web/vite.config.ts`
```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@estudos/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts')
    }
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true
      }
    }
  }
});
```

*Vantagens desta configuração do Vite:*
1. **Zero build overhead durante desenvolvimento**: O alias `@estudos/domain` aponta diretamente para o código fonte TypeScript `src/index.ts`. Qualquer alteração nas regras puras de domínio tem Hot Module Replacement (HMR) instantâneo no frontend sem necessidade de compilar previamente.
2. **Proxy transparente para `/api`**: O proxy do Vite redireciona requisições locais para o backend (`http://localhost:3001`). O navegador trata cookies `httpOnly` como de mesma origem (`SameSite=Lax`), eliminando problemas de CORS no desenvolvimento.

#### D. `apps/web/tailwind.config.js`
```js
/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [],
}
```

#### E. `apps/web/postcss.config.js`
```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

#### F. `apps/web/vitest.config.ts`
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@estudos/domain': path.resolve(__dirname, '../../packages/domain/src/index.ts')
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}']
  }
});
```

---

## 3. Roteiro de Implementação Passo a Passo para o Worker

Abaixo está a sequência exata de ações que o Worker deve executar para implantar o Milestone 1 sem erros:

### Etapa 1: Criação dos Arquivos de Configuração da Raiz
Criar:
- `package.json`
- `tsconfig.base.json`
- `tsconfig.json`
- `vitest.workspace.ts`
- `docker-compose.yml`
- `.env.example`
- `.gitignore`

### Etapa 2: Criação do Pacote `packages/domain`
1. Criar diretórios: `packages/domain/src/{auth,tree,formulas}` e `packages/domain/tests`.
2. Criar `packages/domain/package.json`
3. Criar `packages/domain/tsconfig.json`
4. Criar `packages/domain/vitest.config.ts`
5. Criar `packages/domain/src/index.ts` com schemas e funções determinísticas iniciais.
6. Criar `packages/domain/tests/domain.test.ts` com teste de sanidade.

### Etapa 3: Criação do Pacote `apps/api`
1. Criar diretórios: `apps/api/src/{config,controllers,middlewares,routes,services}`, `apps/api/prisma`, `apps/api/tests`.
2. Criar `apps/api/package.json`
3. Criar `apps/api/tsconfig.json`
4. Criar `apps/api/vitest.config.ts`
5. Criar `apps/api/src/app.ts` e `apps/api/src/server.ts`
6. Criar `apps/api/tests/health.test.ts` testando a rota `/api/health`.

### Etapa 4: Criação do Pacote `apps/web`
1. Criar diretórios: `apps/web/src/{components/{layout,ui,tree},pages,hooks,services,types}`, `apps/web/tests`.
2. Criar `apps/web/package.json`
3. Criar `apps/web/tsconfig.json`
4. Criar `apps/web/vite.config.ts`
5. Criar `apps/web/vitest.config.ts`
6. Criar `apps/web/tailwind.config.js` e `apps/web/postcss.config.js`
7. Criar `apps/web/index.html`, `apps/web/src/main.tsx`, `apps/web/src/App.tsx`, `apps/web/src/index.css`.
8. Criar teste de sanidade em `apps/web/tests/app.test.ts`.

### Etapa 5: Instalação e Vinculação de Dependências
Executar na raiz:
```bash
npm install
```

### Etapa 6: Verificação de Compilação e Testes
Executar em sequência para validar todo o ferramental:
```bash
npm run typecheck
npm test
npm run build
```

---

## 4. Conclusão Técnica

O design elaborado satisfaz rigorosamente todos os requisitos especificados em `ORIGINAL_REQUEST.md`, `PROJECT.md` e `01-contexto-do-projeto.md`:
- Permite desenvolvimento ágil com suporte nativo a workspaces do npm 11.
- Suporta compilação estrita e unificada de TypeScript com `tsc -b`.
- Execução rápida e em paralelo de testes com Vitest.
- Garante total compatibilidade com o ambiente Windows 11 do usuário.
