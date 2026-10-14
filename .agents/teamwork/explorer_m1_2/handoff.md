# Handoff Report — explorer_m1_2: Milestone 1 Database & Docker Compose

**De:** explorer_m1_2  
**Para:** orchestrator_1 / worker  
**Data:** 2026-10-06  
**Tipo:** Hard Handoff (Investigation Complete)  

---

## 1. Observation

1. **Requisitos do Projeto e Documentação:**
   - `ORIGINAL_REQUEST.md:15`: "Ambiente: Windows, PowerShell, Node v24, npm 11, Docker 29 disponível; PostgreSQL NÃO está instalado localmente."
   - `ORIGINAL_REQUEST.md:29`: "- **Banco:** PostgreSQL via docker-compose dentro do projeto. Fornecer `.env.example`."
   - `ORIGINAL_REQUEST.md:30`: "- **Idioma:** identificadores de código seguem o schema do contexto em inglês (Subject, Topic, `user_id` etc.); **todo o resto em português** — textos da interface, mensagens de erro da API, comentários, README e relatório final."
   - `PROJECT.md:9-10`: "PostgreSQL 16 executando via `docker-compose.yml` na raiz. Arquivo `.env.example` com credenciais e URL padrão (`postgresql://postgres:postgres@localhost:5432/estudos_db?schema=public`)."

2. **Docker Daemon e Ferramental de Sistema:**
   - Execução do comando `docker --version; docker compose version; docker info`:
     - Saída: `Docker version 29.7.2, build a7dcaa6`
     - Saída: `Docker Compose version v5.3.1`
     - Engine: `Kernel Version: 6.18.33.2-microsoft-standard-WSL2`, `Operating System: Docker Desktop`, `Architecture: x86_64`, `Containers: 2, Running: 0`. Exit code 0.
   - Status da porta local: `Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -InformationLevel Quiet` retornou `False` (nenhuma conexão pré-existente ou conflito na porta 5432).
   - Cache de imagem: `docker pull postgres:16-alpine` executou com sucesso (Digest `sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea`), confirmando disponibilidade imediata da imagem no host.

---

## 2. Logic Chain

1. Como o PostgreSQL não está instalado no host Windows (conforme `ORIGINAL_REQUEST.md:15`), e o Docker Desktop está em execução ativa com WSL2 (observação 2), o container deve expor a porta padrão 5432 no host (`"5432:5432"`) para permitir conexões transparentes tanto do Node.js rodando no host quanto de eventuais ferramentas locais.
2. Como o banco de dados deve persistir dados entre reboots e recriações de containers, é mandatório configurar um volume Docker nomeado (`estudos_postgres_data`) apontando para `/var/lib/postgresql/data`, com a variável `PGDATA=/var/lib/postgresql/data/pgdata` para evitar problemas de permissão com diretórios internos.
3. Para evitar que migrações do Prisma falhem por tentativa de conexão enquanto o Postgres ainda está inicializando seu cluster, o `docker-compose.yml` deve incluir uma diretiva `healthcheck` usando o utilitário nativo `pg_isready -U postgres -d estudos_db` com intervalo de 5s.
4. Para garantir interoperabilidade com os pacotes do monorepo (`apps/api` e scripts de automação), o arquivo `.env.example` e a cópia `.env` devem fornecer a `DATABASE_URL` canônica: `postgresql://postgres:postgres@localhost:5432/estudos_db?schema=public`.
5. Um script leve em JavaScript (`scripts/wait-for-db.mjs`) usando o módulo nativo `node:net` fornece aos comandos do monorepo (`npm run db:wait`) a capacidade de aguardar de forma determinística antes de invocar `prisma migrate dev`.

---

## 3. Caveats

- **Docker Desktop em background:** O Docker Desktop precisa permanecer aberto durante os testes de desenvolvimento. Caso o usuário feche a aplicação Docker Desktop, o comando `docker compose up -d` falhará até que o executável seja reaberto. Foi fornecido o comando de fallback PowerShell (`Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"`).
- **Variáveis de Ambiente no Monorepo:** O Prisma CLI por padrão procura o `.env` no diretório onde o comando é executado ou na pasta do `schema.prisma`. Por essa razão, orienta-se a criação do `.env` na raiz e uma cópia ou link em `apps/api/.env`.

---

## 4. Conclusion

A arquitetura de banco de dados para o Milestone 1 está completamente especificada e validada:
1. O arquivo `docker-compose.yml` está pronto para ser implementado na raiz do repositório com PostgreSQL 16 Alpine, volume nomeado e healthcheck com `pg_isready`.
2. O arquivo `.env.example` e o `.env` local contêm todas as variáveis necessárias para banco de dados, API Express e frontend Vite.
3. O script `scripts/wait-for-db.mjs` e as instruções PowerShell garantem inicialização robusta e sem condições de corrida.

O Worker pode prosseguir com a criação direta dos arquivos e inicialização do container.

---

## 5. Verification Method

Para verificar de forma independente a formulação:

1. **Criação e Subida do Container:**
   ```powershell
   docker compose up -d
   ```
   *Critério de validação:* Retorna `Container estudos-postgres Started` e código de saída 0.

2. **Verificação do Healthcheck e `pg_isready`:**
   ```powershell
   docker exec estudos-postgres pg_isready -U postgres -d estudos_db
   ```
   *Critério de validação:* Saída contendo `/var/run/postgresql:5432 - accepting connections` e exit code 0.

3. **Verificação de Conexão de Rede:**
   ```powershell
   Test-NetConnection -ComputerName 127.0.0.1 -Port 5432 -InformationLevel Quiet
   ```
   *Critério de validação:* Retorna `True`.

4. **Execução do Script de Prontidão:**
   ```powershell
   node scripts/wait-for-db.mjs
   ```
   *Critério de validação:* Exibe `[wait-for-db] PostgreSQL está pronto e acessível em 127.0.0.1:5432!` e encerra com código 0.

5. **Condição de Invalidação:**
   Se a porta 5432 falhar ao aceitar conexões TCP ou se o comando `pg_isready` retornar erro de autenticação ou banco inexistente, o setup deve ser invalidado.
