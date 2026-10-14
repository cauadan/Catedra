# Relatório de Investigação do Ambiente e Código — explorer_survey_3

**Data:** 2026-10-06  
**Diretório do Projeto:** `c:\Users\cauad\Documents\Estudos`  
**Objetivo:** Mapear o estado atual do repositório, ferramentas do ambiente host (Node, npm, Docker), portas de rede disponíveis, riscos potenciais e propor a estratégia recomendada de monorepo (npm workspaces, TypeScript, Docker, Prisma).

---

## 1. Inventário de Arquivos e Diretórios na Raiz

A raiz do projeto (`c:\Users\cauad\Documents\Estudos`) é um ambiente **greenfield (em estado limpo)**, contendo apenas a especificação inicial fornecida:

| Nome do Arquivo / Pasta | Tipo | Tamanho | Descrição / Função |
|---|---|---|---|
| `.agents/` | Diretório | — | Metadados e registros de coordenação de agentes (Teamwork) |
| `01-contexto-do-projeto.md` | Arquivo | 9.387 bytes | Regras de ouro do projeto, stack técnica, modelo de dados Prisma, fórmulas |
| `02-prompts-por-fase.md` | Arquivo | 7.999 bytes | Detalhamento do escopo e critérios de aceite das Fases 1 a 8 |
| `Documentação Inicial — Plataforma de Gestão e Análise de Estudos.md` | Arquivo | 17.038 bytes | Visão de produto original e jornada de usuário |
| `ORIGINAL_REQUEST.md` | Arquivo | 4.454 bytes | Solicitação mandatória: implementar Fases 1 e 2, restrições e critérios |

### O que NÃO existe atualmente na raiz:
- Nenhum `package.json` ou `package-lock.json`
- Nenhum `docker-compose.yml` ou `Dockerfile`
- Nenhum arquivo `.env` ou `.env.example`
- Nenhum `tsconfig.json`
- Nenhuma pasta de código (`apps/`, `packages/`, `src/`)
- Nenhum arquivo `.gitignore`

---

## 2. Diagnóstico do Git e Estrutura de Repositório

### Descoberta Crítica sobre o Git:
- **Ausência de `.git` em `Estudos`**: O diretório `c:\Users\cauad\Documents\Estudos` **não** possui um diretório `.git` próprio.
- **Git ativo no diretório pai (`C:\Users\cauad\Documents`)**:
  - Comando executado: `git rev-parse --show-toplevel`
  - Resultado: `C:/Users/cauad/Documents`
  - Remote: `origin https://github.com/cauadan/Desafio-class-DIO.git`
  - Status: `Estudos` aparece como diretório não rastreado (`untracked`) dentro do repositório pai `Documents`.
- **Risco Identificado**: Qualquer operação de git (`git add`, `git commit`, `git status`) executada sem inicialização isolada pode acidentalmente interagir com o repositório de `Documents`.
- **Recomendação**:
  1. Criar um `.gitignore` robusto dentro de `c:\Users\cauad\Documents\Estudos` imediatamente.
  2. Executar `git init` dentro de `c:\Users\cauad\Documents\Estudos` caso o usuário/orquestrador deseje que este projeto seja um repositório git independente e isolado do diretório pessoal `Documents`.

---

## 3. Diagnóstico do Ambiente do Host (Windows, Node, npm, Docker)

### 3.1. Sistema Operacional e Shell
- **SO**: Microsoft Windows 11 Pro 64 bits (Build 26100).
- **Memória RAM Total**: ~16 GB (16.551.224 KB), com ~2,3 GB de memória física livre no momento da medição.
- **Shell Padrão**: Windows PowerShell 5.1 (`5.1.26100.9549`).

### 3.2. Node.js e Gerenciadores de Pacote
- **Node.js**: `v24.16.0` (suporte a ESM moderno, módulos nativos, NodeNext).
- **npm**: `11.13.0` (suporte completo e nativo a npm workspaces).
- **npx**: `11.13.0`.

### 3.3. Docker e Docker Compose
- **Docker CLI**: `Docker version 29.7.2, build a7dcaa6`
- **Docker Compose CLI**: `Docker Compose version v5.3.1` (plugin nativo do Docker CLI v2/v5)
- **Localização do Executável**: `C:\Program Files\Docker\Docker\Docker Desktop.exe`
- **Estado do Daemon Docker**:
  - Comando: `docker ps`
  - Erro obtido: `failed to connect to the docker API at npipe:////./pipe/dockerDesktopLinuxEngine: The system cannot find the file specified.`
  - Verificação WSL: `wsl -l -v` indicou que a distribuição `docker-desktop` está no estado `Stopped`.
  - **Conclusão**: O Docker Desktop está devidamente instalado no sistema, mas **o daemon/aplicativo não está rodando no momento**.
  - **Ação necessária para testes com banco**: Iniciar o Docker Desktop (via interface gráfica ou comando no terminal) antes de executar `docker compose up -d` ou migrações do Prisma que dependam do container PostgreSQL.

---

## 4. Diagnóstico de Portas de Rede e Conflitos

Foi realizada a varredura completa de portas TCP no estado `Listen` via `Get-NetTCPConnection`:

| Porta | Serviço Típico | Estado Atual no Host | Risco de Conflito |
|---|---|---|---|
| **5432** | PostgreSQL | **LIVRE** (nenhum processo escutando) | Nenhum. O PostgreSQL via Docker poderá fazer bind direto em `5432:5432`. |
| **3000** | Frontend Web / API | **LIVRE** (nenhum processo escutando) | Nenhum. Pode ser usada para `apps/web` ou `apps/api`. |
| **3001** | Backend API | **LIVRE** (nenhum processo escutando) | Nenhum. Excelente escolha para `apps/api`. |
| **5173** | Vite Dev Server | **LIVRE** (nenhum processo escutando) | Nenhum. Porta padrão do Vite livre para uso. |
| **8080** | Proxy / HTTP alternativo | **LIVRE** | Nenhum. |

**Conclusão de Portas**: Não há conflito com nenhuma das portas padrão da stack proposta.

---

## 5. Estratégia Recomendada para o Monorepo

Considerando os requisitos do projeto (**Node v24 + npm 11 + Windows + Docker + React 19 + Express + Prisma + Vitest**), segue a arquitetura recomendada:

### 5.1. Estrutura de Pastas
```text
c:\Users\cauad\Documents\Estudos/
├── apps/
│   ├── api/                     # Backend: Node + Express + TypeScript + Prisma
│   │   ├── prisma/
│   │   │   ├── schema.prisma    # Schema completo (seção 6 do contexto)
│   │   │   └── migrations/      # Migração inicial
│   │   ├── src/
│   │   │   ├── controllers/     # Controladores HTTP
│   │   │   ├── middleware/      # Sessão, auth e injeção de user_id (401 se ausente)
│   │   │   ├── routes/          # Rotas (/api/auth, /api/subjects, /api/topics, etc.)
│   │   │   ├── services/        # Regras de negócio e acesso ao Prisma
│   │   │   └── index.ts         # Ponto de entrada do Express
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── vitest.config.ts
│   └── web/                     # Frontend: React 19 + Vite + Tailwind + shadcn/ui
│       ├── src/
│       │   ├── components/      # Componentes UI (árvore, botões, modais)
│       │   ├── pages/           # Telas (Login, Cadastro, Matérias/Assuntos, Layout base)
│       │   ├── lib/             # API client (fetch/axios com credentials include)
│       │   ├── App.tsx
│       │   └── main.tsx
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts       # Proxy configurado para encaminhar /api -> localhost:3001
│       └── tailwind.config.js
├── packages/
│   └── domain/                  # Lógica pura, cálculos e esquemas Zod compartilhados
│       ├── src/
│       │   ├── calculations/    # Funções puras (fórmulas da seção 8 do contexto)
│       │   ├── schemas/         # Validações Zod (auth, subjects, topics, etc.)
│       │   ├── types/           # Tipos TypeScript de domínio
│       │   └── index.ts         # Exportação única
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
├── docker-compose.yml           # Serviço postgres:16 alpine com volume e healthcheck
├── .env.example                 # Exemplo de variáveis (DATABASE_URL, SESSION_SECRET, PORT, etc.)
├── .gitignore                   # Ignora node_modules, dist, .env, .agents/teamwork/*, etc.
├── package.json                 # Raiz com npm workspaces ("apps/*", "packages/*")
├── tsconfig.base.json           # Configuração base de TypeScript
└── README.md                    # Instruções em português de setup e execução
```

### 5.2. Mapeamento de Dependências e Pacotes Internos
- **`packages/domain`**:
  - `"name": "@estudos/domain"`
  - `"main": "./src/index.ts"` (durante desenvolvimento com tsx/vitest) e `"types": "./src/index.ts"` ou compilado para `dist/`.
  - Dependências: `zod`.
  - Totalmente desacoplado: sem dependência de banco (Prisma) nem UI (React).
- **`apps/api`**:
  - Depende de `"@estudos/domain": "*"` via npm workspace.
  - Dependências: `express`, `cors`, `cookie-parser`, `bcrypt` (ou `argon2`), `zod`, `@prisma/client`.
  - DevDependencies: `prisma`, `tsx`, `vitest`, `supertest`, `@types/express`, `@types/cookie-parser`, `@types/supertest`, `typescript`.
- **`apps/web`**:
  - Depende de `"@estudos/domain": "*"` via npm workspace (reaproveitando schemas Zod para formulários).
  - Dependências: `react`, `react-dom`, `@tanstack/react-query`, `lucide-react`, `clsx`, `tailwind-merge`.
  - DevDependencies: `vite`, `@vitejs/plugin-react`, `tailwindcss`, `postcss`, `autoprefixer`, `typescript`.

### 5.3. Configuração de Scripts na Raiz (`package.json`)
Os scripts da raiz devem garantir conformidade com o critério de aceite:
> `"npm test" passa na raiz; "tsc" sem erros em todos os pacotes.`

Recomendação de scripts:
```json
{
  "name": "estudos-monorepo",
  "private": true,
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "dev:api": "npm run dev --workspace=apps/api",
    "dev:web": "npm run dev --workspace=apps/web",
    "dev": "concurrently -n \"API,WEB\" -c \"blue,green\" \"npm run dev:api\" \"npm run dev:web\"",
    "build": "npm run build --workspaces",
    "test": "vitest run",
    "typecheck": "npm run typecheck --workspaces",
    "db:up": "docker compose up -d",
    "db:down": "docker compose down",
    "db:migrate": "npm run prisma:migrate --workspace=apps/api",
    "db:studio": "npm run prisma:studio --workspace=apps/api"
  }
}
```

### 5.4. Compatibilidade no Windows (PowerShell + Node v24)
1. **Evitar comandos POSIX em scripts**: Não utilizar comandos como `rm -rf` ou `export VAR=val` nos scripts do `package.json`. Preferir `rimraf` ou comandos nativos do Node/npm (`node -e ...`).
2. **Arquivos `.env`**: Utilizar `dotenv` no backend ou flags nativas de ambiente. Criar `.env.example` claro.
3. **Vite Proxy**: Configurar no `vite.config.ts`:
   ```ts
   server: {
     port: 5173,
     proxy: {
       '/api': {
         target: 'http://localhost:3001',
         changeOrigin: true,
         secure: false,
       }
     }
   }
   ```
   Isso permite que cookies de sessão httpOnly trafeguem na mesma origem sem problemas de CORS ou SameSite no navegador durante o desenvolvimento local.
4. **Prisma no Windows**: O Prisma detecta automaticamente o binário para Windows (`query_engine-windows.dll.node`). É recomendável manter `binaryTargets = ["native"]` no `schema.prisma`.
5. **Configuração do Docker Compose (`docker-compose.yml`)**:
   ```yaml
   services:
     postgres:
       image: postgres:16-alpine
       container_name: estudos-postgres
       restart: unless-stopped
       environment:
         POSTGRES_USER: postgres
         POSTGRES_PASSWORD: postgrespassword
         POSTGRES_DB: estudos
       ports:
         - "5432:5432"
       volumes:
         - postgres_data:/var/lib/postgresql/data
       healthcheck:
         test: ["CMD-SHELL", "pg_isready -U postgres -d estudos"]
         interval: 5s
         timeout: 5s
         retries: 5

   volumes:
     postgres_data:
   ```

---

## 6. Riscos e Mitigações

1. **Daemon do Docker desligado**:
   - *Risco*: `docker compose up -d` ou `npx prisma migrate dev` falhará até que o Docker Desktop seja iniciado.
   - *Mitigação*: Documentar explicitamente no README e no handoff a necessidade de abrir o Docker Desktop antes de executar comandos de banco.
2. **Repositório Git pai acidental**:
   - *Risco*: `C:\Users\cauad\Documents` possui um `.git` para outro repositório.
   - *Mitigação*: Criar `.gitignore` imediato em `Estudos` e considerar isolamento com `git init` em `Estudos`.
3. **Versão do React 19**:
   - *Risco*: Algumas bibliotecas de componentes legadas podem ter conflitos de peer dependency com React 19.
   - *Mitigação*: Usar shadcn/ui com componentes modernos e Tailwind v4/v3 estáveis compatíveis com React 19.
