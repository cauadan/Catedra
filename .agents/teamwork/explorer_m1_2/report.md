# Relatório de Investigação Técnica — Milestone 1: Banco de Dados & Docker Compose

**Agente:** explorer_m1_2  
**Data:** 2026-10-06  
**Status:** CONCLUÍDO  

---

## 1. Resumo Executivo

Este documento apresenta a especificação técnica completa para a infraestrutura de banco de dados do projeto **Plataforma de Gestão e Análise de Estudos**. Foram investigados o ambiente de execução local (Windows / PowerShell / Docker Desktop / WSL2), a disponibilidade de portas de rede e a configuração do container PostgreSQL 16 com persistência e healthcheck.

Todas as definições seguem rigorosamente:
- `ORIGINAL_REQUEST.md`: PostgreSQL via Docker Compose, tudo em português (documentação, comentários, mensagens de erro), `.env.example` fornecido.
- `PROJECT.md`: PostgreSQL 16 na porta 5432, banco padrão `estudos_db`, URL de conexão padronizada.
- `01-contexto-do-projeto.md` (§3, §6): Prisma ORM + PostgreSQL, isolamento estrito e integridade relacional.

---

## 2. Diagnóstico do Ambiente Local

Os seguintes testes foram executados via PowerShell no host:

1. **Docker Engine e Compose:**
   - Docker version: `29.7.2` (build `a7dcaa6`)
   - Docker Compose version: `v5.3.1`
   - Daemon status: **Ativo e operacional** (executando via backend WSL2 `6.18.33.2-microsoft-standard-WSL2`, 7.64 GiB RAM alocada).
2. **Disponibilidade da Porta 5432:**
   - Testada via `Get-NetTCPConnection -LocalPort 5432` e `Test-NetConnection -Port 5432`.
   - Resultado: **Porta 5432 totalmente desimpedida e disponível** no host local.
3. **Disponibilidade da Imagem:**
   - A imagem oficial `postgres:16-alpine` já foi baixada com sucesso no cache local do Docker (`docker.io/library/postgres:16-alpine`), garantindo inicialização instantânea sem atrasos de download.

---

## 3. Especificação Completa dos Arquivos

### 3.1. Arquivo `docker-compose.yml` (Raiz do Projeto)
**Caminho:** `c:\Users\cauad\Documents\Estudos\docker-compose.yml`

```yaml
services:
  postgres:
    image: postgres:16-alpine
    container_name: estudos-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-postgres}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: ${POSTGRES_DB:-estudos_db}
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - "${POSTGRES_PORT:-5432}:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-postgres} -d ${POSTGRES_DB:-estudos_db}"]
      interval: 5s
      timeout: 5s
      retries: 5
      start_period: 5s

volumes:
  postgres_data:
    name: estudos_postgres_data
```

**Justificativas Técnicas do Design:**
1. **`postgres:16-alpine`**: Imagem ultra-leve (~80MB), reduz tempo de inicialização, inclui `pg_isready` nativo.
2. **`PGDATA: /var/lib/postgresql/data/pgdata`**: Isola os arquivos do cluster em um subdiretório do volume, prevenindo erros de permissão com diretórios `lost+found` do Docker.
3. **`healthcheck` com `pg_isready`**: Permite que scripts de inicialização e o Prisma aguardem o estado `healthy` antes de disparar migrações, evitando condições de corrida (*race conditions*).
4. **Volume nomeado explícito `estudos_postgres_data`**: Garante persistência dos dados entre reinicializações do container sem risco de colisões acidentais.

---

### 3.2. Arquivo `.env.example` (Raiz do Projeto)
**Caminho:** `c:\Users\cauad\Documents\Estudos\.env.example`

```env
# ==========================================
# Banco de Dados (PostgreSQL / Docker Compose)
# ==========================================
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=estudos_db
POSTGRES_PORT=5432

# URL de conexão Prisma (PostgreSQL)
# Formato: postgresql://<user>:<password>@<host>:<port>/<database>?schema=<schema>
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/estudos_db?schema=public

# ==========================================
# Configurações do Backend (apps/api)
# ==========================================
PORT=3001
NODE_ENV=development
SESSION_SECRET=chave_secreta_super_segura_para_desenvolvimento_com_32_bytes!
CORS_ORIGIN=http://localhost:5173

# ==========================================
# Configurações do Frontend (apps/web)
# ==========================================
VITE_API_URL=http://localhost:3001/api
```

---

### 3.3. Arquivo `.env` (Ambiente de Desenvolvimento Local)
**Caminho:** `c:\Users\cauad\Documents\Estudos\.env`
(Deve ser copiado a partir do `.env.example` e espelhado em `apps/api/.env` para garantir que comandos rodando tanto da raiz quanto dentro do workspace da API acessem as variáveis perfeitamente).

```env
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=estudos_db
POSTGRES_PORT=5432
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/estudos_db?schema=public
PORT=3001
NODE_ENV=development
SESSION_SECRET=chave_secreta_super_segura_para_desenvolvimento_com_32_bytes!
CORS_ORIGIN=http://localhost:5173
VITE_API_URL=http://localhost:3001/api
```

---

### 3.4. Script de Verificação de Prontidão (`scripts/wait-for-db.mjs`)
**Caminho:** `c:\Users\cauad\Documents\Estudos\scripts\wait-for-db.mjs`

Este script utiliza apenas módulos nativos do Node.js (`node:net`), sem exigir nenhuma dependência externa pré-instalada. Ele verifica se a porta do banco está aceitando conexões ativamente e aguarda até que o serviço esteja pronto.

```javascript
/**
 * Script de verificação de prontidão do PostgreSQL.
 * Utiliza apenas módulos nativos (node:net) para funcionar antes de qualquer 'npm install'.
 */
import net from 'node:net';

const host = process.env.DB_HOST || '127.0.0.1';
const port = parseInt(process.env.DB_PORT || '5432', 10);
const maxAttempts = 30;
let attempts = 0;

console.log(`[wait-for-db] Aguardando PostgreSQL em ${host}:${port}...`);

function check() {
  attempts++;
  const socket = new net.Socket();
  socket.setTimeout(2000);

  socket.on('connect', () => {
    console.log(`[wait-for-db] PostgreSQL está pronto e acessível em ${host}:${port}!`);
    socket.destroy();
    process.exit(0);
  });

  socket.on('error', () => {
    socket.destroy();
    if (attempts >= maxAttempts) {
      console.error(`[wait-for-db] Erro: Tempo limite atingido (${maxAttempts}s) sem resposta do PostgreSQL.`);
      process.exit(1);
    }
    setTimeout(check, 1000);
  });

  socket.on('timeout', () => {
    socket.destroy();
    if (attempts >= maxAttempts) {
      console.error(`[wait-for-db] Erro: Timeout na conexão com ${host}:${port}.`);
      process.exit(1);
    }
    setTimeout(check, 1000);
  });

  socket.connect(port, host);
}

check();
```

---

### 3.5. Script de Verificação com Prisma (`apps/api/src/config/verify-db.ts`)
**Caminho:** `c:\Users\cauad\Documents\Estudos\apps\api\src\config\verify-db.ts`

Script TypeScript para validar a conexão autenticada através do próprio Prisma Client após geração do schema:

```typescript
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyConnection() {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as connected, current_database() as db_name, version() as version`;
    console.log('[OK] Conexão com PostgreSQL via Prisma bem-sucedida:', result);
    process.exit(0);
  } catch (error) {
    console.error('[ERRO] Falha ao conectar ao PostgreSQL via Prisma:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

verifyConnection();
```

---

## 4. Comandos PowerShell para o Worker

O Worker pode executar os seguintes comandos em ordem sequencial no terminal PowerShell:

### Passo 1: Criação dos arquivos de configuração
```powershell
# Criação de .env a partir de .env.example
Copy-Item .env.example .env
if (!(Test-Path "apps\api")) { New-Item -ItemType Directory -Path "apps\api" -Force }
Copy-Item .env.example apps\api\.env
```

### Passo 2: Inicialização do Docker Compose
```powershell
# Subir o container em modo desacoplado
docker compose up -d

# Verificar status do container
docker compose ps
```

### Passo 3: Aguardar Healthcheck do Container
```powershell
# Loop rápido PowerShell aguardando status 'healthy'
$retries = 30
while ($retries -gt 0) {
    $health = docker inspect --format='{{json .State.Health.Status}}' estudos-postgres 2>$null
    if ($health -eq '"healthy"') {
        Write-Host "PostgreSQL reportou status HEALTHY!" -ForegroundColor Green
        break
    }
    Write-Host "Aguardando PostgreSQL ficar saudável... ($retries restantes)"
    Start-Sleep -Seconds 1
    $retries--
}
```

### Passo 4: Verificação nativa via `pg_isready`
```powershell
docker exec estudos-postgres pg_isready -U postgres -d estudos_db
```

### Passo 5: Estratégias de Recuperação e Fallback
1. **Se o Docker Desktop estiver desligado:**
   ```powershell
   Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
   # Aguardar alguns segundos e testar com: docker info
   ```
2. **Se a porta 5432 estiver em conflito:**
   ```powershell
   # Identificar o processo ocupando a porta:
   Get-NetTCPConnection -LocalPort 5432 | Format-Table -Property LocalAddress,LocalPort,OwningProcess,State
   ```
   Caso necessário, ajustar `POSTGRES_PORT=5433` no `.env` e atualizar a `DATABASE_URL` para porta 5433.
3. **Para reiniciar e resetar o volume do banco do zero:**
   ```powershell
   docker compose down -v
   docker compose up -d
   ```

---

## 5. Relação com outros Milestones e Trabalhadores

- **Com `explorer_m1_1` (Monorepo Tooling):**
  - Adicionar script na raiz do `package.json`:
    - `"db:up": "docker compose up -d"`
    - `"db:down": "docker compose down"`
    - `"db:wait": "node scripts/wait-for-db.mjs"`
- **Com `explorer_m1_3` (Prisma Schema):**
  - O datasource no `schema.prisma` usará exatamente a variável de ambiente `DATABASE_URL`.
  - A migração `npx prisma migrate dev --name init` deve ser disparada logo após a confirmação do `db:wait`.
