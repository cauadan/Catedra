// ==============================================================================
// Suíte de Testes Adversariais de Estresse de Timezone e Autenticação (Milestone 2)
// Agente: challenger_m2_2 (Empirical Challenger)
// ==============================================================================

import { PrismaClient } from '@prisma/client';

console.log('================================================================');
console.log('SUÍTE ADVERSÁRIA DE ESTRESSE: TIMEZONES, ESTADO E SESSÃO (M2)');
console.log('================================================================\n');

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const findings = [];

function assert(condition, testName, details = '') {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`[PASS] ${testName}`);
  } else {
    failedTests++;
    console.error(`[FAIL] ${testName} - ${details}`);
    findings.push({ testName, details });
  }
}

// ------------------------------------------------------------------------------
// 1. REPRODUÇÃO E ESTRESSE DA FUNÇÃO DE DETECÇÃO DE TIMEZONE
// ------------------------------------------------------------------------------
console.log('--- 1. ESTRESSE: DETECÇÃO DE FUSO HORÁRIO NO NAVEGADOR ---');

const DEFAULT_TIMEZONE = 'America/Sao_Paulo';

function simulateDetectBrowserTimezone(mockIntl) {
  const originalIntl = globalThis.Intl;
  try {
    if (mockIntl !== undefined) {
      globalThis.Intl = mockIntl;
    }
    const tz = globalThis.Intl?.DateTimeFormat()?.resolvedOptions()?.timeZone;
    return tz && typeof tz === 'string' && tz.trim().length > 0 ? tz : DEFAULT_TIMEZONE;
  } catch {
    return DEFAULT_TIMEZONE;
  } finally {
    globalThis.Intl = originalIntl;
  }
}

function formatTimezoneLabel(timezone) {
  if (timezone === 'America/Sao_Paulo') {
    return 'Horário de Brasília (America/Sao_Paulo)';
  }
  return timezone;
}

// 1.1 Fusos Horários Globais e de Fronteira Reais
const testTimezones = [
  'UTC',
  'America/Noronha',      // UTC-2 (Arquipélago de Fernando de Noronha, fuso brasileiro)
  'America/Sao_Paulo',    // UTC-3 (Horário de Brasília)
  'America/Manaus',       // UTC-4 (Fuso da Amazônia)
  'America/Rio_Branco',   // UTC-5 (Fuso do Acre)
  'Asia/Tokyo',           // UTC+9 (Japão)
  'Pacific/Kiritimati',   // UTC+14 (Ilhas da Linha / Kiribati, fuso mais adiantado do planeta)
  'America/Adak',         // UTC-10 (Ilhas Aleutas, EUA)
  'Pacific/Pago_Pago',    // UTC-11 (Samoa Americana)
  'Pacific/Niue',         // UTC-11 (Niue)
  'Australia/Eucla',      // UTC+8:45 (Offset fracionário raro)
  'Asia/Kathmandu',       // UTC+5:45 (Nepal, offset fracionário)
  'Asia/Kolkata',         // UTC+5:30 (Índia, offset fracionário)
  'Pacific/Chatham',      // UTC+12:45 (Ilhas Chatham, Nova Zelândia)
  'Atlantic/Azores',      // UTC-1 (Açores, Portugal)
  'Europe/London',        // UTC+0 / UTC+1
  'Europe/Berlin',        // UTC+1 / UTC+2
];

for (const tz of testTimezones) {
  const mock = {
    DateTimeFormat: () => ({
      resolvedOptions: () => ({ timeZone: tz }),
    }),
  };
  const detected = simulateDetectBrowserTimezone(mock);
  assert(
    detected === tz,
    `Detecção para fuso de fronteira '${tz}'`,
    `Esperado '${tz}', obtido '${detected}'`
  );
}

// 1.2 Formatação amigável de fusos
assert(
  formatTimezoneLabel('America/Sao_Paulo').includes('Horário de Brasília'),
  'Formatação amigável para America/Sao_Paulo contém Horário de Brasília'
);
assert(
  formatTimezoneLabel('UTC') === 'UTC',
  'Formatação amigável para UTC preserva string UTC'
);
assert(
  formatTimezoneLabel('Asia/Tokyo') === 'Asia/Tokyo',
  'Formatação amigável para Asia/Tokyo preserva string Asia/Tokyo'
);
assert(
  formatTimezoneLabel('America/Noronha') === 'America/Noronha',
  'Formatação amigável para America/Noronha preserva string America/Noronha'
);

// 1.3 Casos Patológicos e Fallback Seguro
console.log('\n--- 2. ESTRESSE: ENTRADAS PATOLÓGICAS E FALLBACK SEGURO ---');

const pathologicalCases = [
  { name: 'String vazia', mock: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: '' }) }) } },
  { name: 'Espaços em branco', mock: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: '   ' }) }) } },
  { name: 'Valor nulo', mock: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: null }) }) } },
  { name: 'Valor indefinido', mock: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: undefined }) }) } },
  { name: 'Objeto ausente', mock: { DateTimeFormat: () => ({ resolvedOptions: () => ({}) }) } },
  { name: 'Tipo numérico', mock: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 12345 }) }) } },
  { name: 'Exceção em resolvedOptions', mock: { DateTimeFormat: () => ({ resolvedOptions: () => { throw new Error('Falha no Intl'); } }) } },
  { name: 'Exceção em DateTimeFormat', mock: { DateTimeFormat: () => { throw new Error('Intl indisponível'); } } },
  { name: 'Intl indefinido', mock: null },
];

for (const c of pathologicalCases) {
  const result = simulateDetectBrowserTimezone(c.mock);
  assert(
    result === 'America/Sao_Paulo',
    `Fallback seguro para caso patológico: ${c.name}`,
    `Esperado 'America/Sao_Paulo', obtido '${result}'`
  );
}

// ------------------------------------------------------------------------------
// 2. TESTES DE INTEGRAÇÃO CONTRA A API REAL E BANCO POSTGRESQL
// ------------------------------------------------------------------------------
console.log('\n--- 3. TESTES DE INTEGRAÇÃO COM A API E BANCO REAL ---');

const API_BASE = process.env.API_URL || 'http://localhost:3001';
const prisma = new PrismaClient();

async function runApiIntegrationTests() {
  const createdUserIds = [];

  try {
    await prisma.$connect();
    console.log('Conexão com PostgreSQL estabelecida com sucesso via Prisma Client.');

    const testUsersToRegister = [
      { tz: 'UTC', label: 'Tempo Universal Coordenado (UTC)' },
      { tz: 'Asia/Tokyo', label: 'Tóquio, Japão (UTC+9)' },
      { tz: 'America/Noronha', label: 'Fernando de Noronha, Brasil (UTC-2)' },
      { tz: 'Pacific/Kiritimati', label: 'Kiritimati, Kiribati (UTC+14 extremo)' },
      { tz: 'Australia/Eucla', label: 'Eucla, Austrália (UTC+8:45 fracionário)' },
      { tz: 'America/Manaus', label: 'Manaus, Brasil (UTC-4)' },
      { tz: '', label: 'Fuso em branco (fallback default)' },
      { tz: '   ', label: 'Fuso apenas espaços (fallback default)' },
      { tz: undefined, label: 'Fuso omitido (fallback default)' },
    ];

    for (let i = 0; i < testUsersToRegister.length; i++) {
      const item = testUsersToRegister[i];
      const stamp = `${Date.now()}_${i}_${Math.floor(Math.random() * 1000)}`;
      const payload = {
        name: `Usuário Teste Tz ${i}`,
        email: `stress_tz_${stamp}@desafio.test`,
        password: 'SenhaForte123!',
      };
      if (item.tz !== undefined) {
        payload.timezone = item.tz;
      }

      const expectedTz = (item.tz && item.tz.trim().length > 0) ? item.tz.trim() : 'America/Sao_Paulo';

      // 1. POST /api/auth/register
      const regRes = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      assert(
        regRes.status === 201,
        `Registro HTTP 201 para fuso '${item.label}'`,
        `Status obtido: ${regRes.status}`
      );

      const regData = await regRes.json();
      assert(
        regData.user && regData.user.timezone === expectedTz,
        `Retorno de timezone correto no registro: '${expectedTz}'`,
        `Obtido: ${regData.user?.timezone}`
      );
      assert(
        regData.user && regData.user.week_starts_on === 'MONDAY',
        `Retorno de week_starts_on 'MONDAY' para usuário`,
        `Obtido: ${regData.user?.week_starts_on}`
      );

      const setCookieHeader = regRes.headers.get('set-cookie') || '';
      assert(
        setCookieHeader.toLowerCase().includes('httponly'),
        `Cookie de sessão contém flag httpOnly no registro (${item.label})`,
        `Set-Cookie: ${setCookieHeader}`
      );
      assert(
        setCookieHeader.toLowerCase().includes('samesite=lax'),
        `Cookie de sessão contém SameSite=Lax`,
        `Set-Cookie: ${setCookieHeader}`
      );

      const userId = regData.user?.id;
      if (userId) {
        createdUserIds.push(userId);

        // 2. Verificação direta no PostgreSQL via Prisma
        const dbUser = await prisma.user.findUnique({ where: { id: userId } });
        assert(
          dbUser !== null && dbUser.timezone === expectedTz,
          `Persistência exata no PostgreSQL para fuso '${expectedTz}'`,
          `No banco: ${dbUser?.timezone}`
        );
        assert(
          dbUser !== null && dbUser.week_starts_on === 'MONDAY',
          `Persistência de week_starts_on 'MONDAY' no PostgreSQL`,
          `No banco: ${dbUser?.week_starts_on}`
        );
        assert(
          dbUser !== null && dbUser.password_hash.startsWith('$2'),
          `Hash de senha bcrypt válido no PostgreSQL`,
          `Hash prefixo: ${dbUser?.password_hash.substring(0, 4)}`
        );

        // 3. Extração do cookie e teste de rota autenticada GET /api/auth/me
        const match = setCookieHeader.match(/session_id=([^;]+)/);
        const sessionCookie = match ? `session_id=${match[1]}` : '';

        const meRes = await fetch(`${API_BASE}/api/auth/me`, {
          method: 'GET',
          headers: { Cookie: sessionCookie },
        });

        assert(
          meRes.status === 200,
          `GET /api/auth/me retorna 200 com cookie de sessão ativo`,
          `Status obtido: ${meRes.status}`
        );
        const meData = await meRes.json();
        assert(
          meData.user?.timezone === expectedTz,
          `GET /api/auth/me preserva fuso horário '${expectedTz}'`,
          `Obtido: ${meData.user?.timezone}`
        );

        // 4. Teste de POST /api/auth/logout
        const logoutRes = await fetch(`${API_BASE}/api/auth/logout`, {
          method: 'POST',
          headers: { Cookie: sessionCookie },
        });
        assert(
          logoutRes.status === 200,
          `POST /api/auth/logout retorna 200`,
          `Status obtido: ${logoutRes.status}`
        );

        // 5. Teste de acesso após logout com cookie antigo (deve retornar 401)
        const meAfterLogout = await fetch(`${API_BASE}/api/auth/me`, {
          method: 'GET',
          headers: { Cookie: sessionCookie },
        });
        assert(
          meAfterLogout.status === 401,
          `GET /api/auth/me rejeita sessão revogada com 401 UNAUTHORIZED`,
          `Status obtido: ${meAfterLogout.status}`
        );

        // 6. Teste de POST /api/auth/login subsequente
        const loginRes = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: payload.email,
            password: payload.password,
          }),
        });
        assert(
          loginRes.status === 200,
          `POST /api/auth/login bem-sucedido (200)`,
          `Status obtido: ${loginRes.status}`
        );
        const loginData = await loginRes.json();
        assert(
          loginData.user?.timezone === expectedTz,
          `Login retorna fuso horário persistido '${expectedTz}'`,
          `Obtido: ${loginData.user?.timezone}`
        );
      }
    }
  } catch (err) {
    console.error('Erro na execução dos testes de integração:', err);
    assert(false, 'Execução da integração contra API e banco', String(err));
  } finally {
    // Limpeza de usuários de teste criados
    if (createdUserIds.length > 0) {
      console.log(`\nLimpando ${createdUserIds.length} usuários temporários de teste...`);
      try {
        await prisma.user.deleteMany({
          where: { id: { in: createdUserIds } },
        });
        console.log('Limpeza concluída com sucesso.');
      } catch (cleanErr) {
        console.warn('Aviso: falha na limpeza do banco:', cleanErr);
      }
    }
    await prisma.$disconnect();
  }

  // ------------------------------------------------------------------------------
  // RELATÓRIO CONSOLIDADO
  // ------------------------------------------------------------------------------
  console.log('\n================================================================');
  console.log(`TOTAL DE TESTES: ${totalTests}`);
  console.log(`APROVADOS:       ${passedTests}`);
  console.log(`FALHAS:          ${failedTests}`);
  console.log('================================================================');

  if (failedTests > 0) {
    console.error('\nFalhas registradas:', findings);
    process.exit(1);
  } else {
    console.log('\nTODOS OS TESTES DE ESTRESSE FORAM APROVADOS COM SUCESSO (100%)!');
    process.exit(0);
  }
}

runApiIntegrationTests();
