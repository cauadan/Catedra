# Relatório de Remediação do Marco 2: Resiliência a Condições de Corrida no Cadastro

**Data:** 2026-10-06  
**Agente:** `worker_m2_remediation`  
**Escopo:** `apps/api/src/services/auth.service.ts`  
**Objetivo:** Eliminar vulnerabilidade TOCTOU (Time-of-Check to Time-of-Use) em cadastros simultâneos com mesmo e-mail, assegurando resposta HTTP 409 CONFLICT padronizada.

---

## 1. Resumo Executivo

O auditor adversarial `challenger_m2_1` identificou que requisições concorrentes de cadastro para o mesmo endereço de e-mail resultavam em **HTTP 500 INTERNAL_ERROR** com lançamento de exceção não tratada do Prisma Client (`PrismaClientKnownRequestError` com código `P2002`).

A falha decorria do intervalo entre a checagem preliminar `prisma.user.findUnique` e a inserção no banco `prisma.user.create`. Durante esse intervalo, o cálculo de hash via `bcrypt` (custo 10) demorava aproximadamente 80-100ms, permitindo que múltiplas requisições simultâneas passassem pela checagem como se o usuário não existisse. Ao invocar `prisma.user.create`, apenas uma requisição obtinha êxito e as demais colidiam na restrição `@unique` do PostgreSQL na coluna `email`, gerando o erro de integridade relacional `P2002`.

A remediação foi aplicada em `apps/api/src/services/auth.service.ts`, tratando explicitamente o código de erro `P2002` do Prisma Client e mapeando-o para `{ success: false, reason: 'conflict' }`, que é convertido pelo `AuthController` em **HTTP 409 CONFLICT** com mensagem em português padronizada (`"E-mail já cadastrado no sistema."`).

---

## 2. Alterações Realizadas no Código-Fonte

### Arquivo Modificado: `apps/api/src/services/auth.service.ts`

1. **Importação do namespace Prisma:**
   Importado `Prisma` a partir de `@prisma/client` para acesso tipado à classe de erro `Prisma.PrismaClientKnownRequestError`.
2. **Tratamento defensivo em `register`:**
   A chamada `prisma.user.create` foi envolvida em um bloco `try/catch`. Caso o erro capturado seja uma instância de `Prisma.PrismaClientKnownRequestError` com código `P2002`, o método retorna `{ success: false, reason: 'conflict' }`. Quaisquer outros erros não mapeados são relançados via `throw error;`.

### Trecho do Código Implementado:
```typescript
import { Prisma } from '@prisma/client';
// ...
try {
  const user = await prisma.user.create({
    data: {
      name: dto.name.trim(),
      email: normalizedEmail,
      password_hash: passwordHash,
      timezone,
      week_starts_on: 'MONDAY',
    },
    select: {
      id: true,
      name: true,
      email: true,
      timezone: true,
      week_starts_on: true,
      created_at: true,
      updated_at: true,
    },
  });

  const sessionId = sessionService.createSession(user.id);
  return { success: true, user, sessionId };
} catch (error) {
  // Captura violação de restrição única do Prisma (P2002) decorrente de concorrência simultânea (TOCTOU)
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    return { success: false, reason: 'conflict' };
  }
  throw error;
}
```

---

## 3. Evidências Empíricas de Validação

Todos os quatro comandos mandatários foram executados e validados:

### 3.1 Suíte de Testes Adversariais (`tests/adversarial-auth.test.ts`)
- **Comando:**
  ```powershell
  npm --workspace=@estudos/api run test -- tests/adversarial-auth.test.ts
  ```
- **Resultado:** **26/26 APROVADOS (100%)**
- **Saída obtida:**
  ```text
  RUN  v3.2.7 C:/Users/cauad/Documents/Estudos/apps/api

   ✓ tests/adversarial-auth.test.ts (26 tests) 1780ms

   Test Files  1 passed (1)
        Tests  26 passed (26)
     Duration  2.93s
  ```

### 3.2 Suíte Padrão de Autenticação (`tests/auth.test.ts`)
- **Comando:**
  ```powershell
  npm --workspace=@estudos/api run test -- tests/auth.test.ts
  ```
- **Resultado:** **13/13 APROVADOS (100%)**
- **Saída obtida:**
  ```text
  RUN  v3.2.7 C:/Users/cauad/Documents/Estudos/apps/api

   ✓ tests/auth.test.ts (13 tests) 475ms

   Test Files  1 passed (1)
        Tests  13 passed (13)
     Duration  1.63s
  ```

### 3.3 Suíte Global do Monorepo (`npm test`)
- **Comando:**
  ```powershell
  npm test
  ```
- **Resultado:** **62/62 APROVADOS (100% de sucesso em todos os 3 workspaces)**
- **Workspaces validados:**
  * `@estudos/domain`: 16 testes (regras de árvore, invariantes de ciclo e esquemas Zod)
  * `@estudos/api`: 41 testes (health, auth padrão e auditoria adversarial de segurança)
  * `@estudos/web`: 5 testes (renderização da casca, layout base e tela de autenticação)
- **Saída obtida:**
  ```text
  Test Files  6 passed (6)
       Tests  62 passed (62)
    Duration  4.97s
  ```

### 3.4 Checagem Estática de Tipagem (`npm run typecheck`)
- **Comando:**
  ```powershell
  npm run typecheck
  ```
- **Resultado:** **0 ERROS (`tsc -b` executado com sucesso e zero inconsistências de tipo)**

---

## 4. Conclusão

A vulnerabilidade de condição de corrida TOCTOU foi completamente neutralizada no nível de aplicação e persistência relacional. As 4 requisições concorrentes duplicadas recebem agora o código HTTP 409 CONFLICT padronizado, respeitando integralmente as especificações de `PROJECT.md` e os requisitos de integridade do sistema.
