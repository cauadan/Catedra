# Plataforma de Gestão e Análise de Estudos

Bem-vindo ao monorepo da **Plataforma de Gestão e Análise de Estudos**. Este repositório contém a infraestrutura base (Fase 1) e o gerenciamento da Árvore de Matérias e Assuntos (Fase 2).

## Estrutura do Projeto

O projeto adota uma arquitetura de Monorepo com NPM Workspaces:
- `apps/api`: Backend em Node.js com Express e Prisma ORM (PostgreSQL).
- `apps/web`: Frontend em React 19 (Vite) com TanStack Query e Tailwind CSS.
- `packages/domain`: Biblioteca compartilhada contendo contratos (Zod), tipos e funções puras de regras de negócio.

## Pré-requisitos

- **Node.js** v24+
- **NPM** v11+
- **Docker** (para rodar o banco de dados PostgreSQL localmente)

## Como Rodar

1. Inicie o Docker Desktop em sua máquina.
2. Na raiz do projeto, suba o banco de dados rodando o Docker Compose:
   ```bash
   docker compose up -d
   ```
3. Instale as dependências de todo o monorepo:
   ```bash
   npm install
   ```
4. Configure as variáveis de ambiente (use os `.env.example` localizados em `apps/api` e `apps/web` como base).
5. Rode a migração inicial do banco de dados (Prisma):
   ```bash
   npm run db:push --workspace=@estudos/api
   # ou npx prisma db push --schema=apps/api/prisma/schema.prisma
   ```
6. Inicie a aplicação (Backend e Frontend simultaneamente):
   ```bash
   npm run dev
   ```
7. Acesse a interface web em `http://localhost:5173`.

## Como Testar

Os testes automatizados foram criados utilizando **Vitest** e utilizam o banco de dados real (não mockado) para garantir a integridade das operações e regras de negócio.
Para executar toda a bateria de testes de uma vez a partir da raiz:

```bash
npm test
```

Para verificar se há algum erro de tipagem no TypeScript (sem gerar arquivos de build):

```bash
npm run typecheck
```

## O Que Foi Entregue (Fases 1 e 2)

- **Fundação (Fase 1)**: Banco configurado via Docker, schema inicial do Prisma completo (com base no contexto do projeto), sistema de registro, login (senhas salvas com bcrypt) e emissão de sessões por `httpOnly` cookie.
- **Matérias e Assuntos (Fase 2)**:
  - CRUD completo de matérias (Subjects) e assuntos (Topics).
  - Regra de negócio implementada no backend (`packages/domain`) validando e impedindo criação de ciclos na árvore de assuntos.
  - Arquivamento em cascata (se você arquiva uma matéria, todos os assuntos são arquivados).
  - Proteção de exclusão caso haja sessões futuras vinculadas.
  - Interface do usuário (`Subjects.tsx`) em formato de árvore recursiva (profundidade livre) permitindo gerenciar tudo visualmente.
- Toda validação de input nas rotas está protegida pelo Zod.
- Todo dado retornado é estritamente isolado pelo `user_id`.

## O Que Ficou de Fora (Próximas Fases)

Conforme instruído no contexto e nos marcos atuais, entregamos o core do sistema para prepará-lo para as próximas evoluções. O que **não** está contemplado nesta entrega, mas que possui estrutura para suportar sem retrabalho:

- **Fase 3**: Agenda e Planejamento, e Timer/Cronômetro de Sessão.
- **Fase 4**: Metas e Estatísticas Qualitativas (Classificação FORTE, REGULAR, FRACO).
- **Fase 5**: Observatório Semanal.

A fundação, testes, roteamento (PlaceholderModules) e esquemas de banco já foram montados para suportar perfeitamente a implementação modular dessas fases futuras.
