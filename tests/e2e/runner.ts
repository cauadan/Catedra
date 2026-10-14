// E2E Test Suite Runner for Fases 1 & 2
// plataform-de-estudos
// Can be executed via: node --experimental-strip-types tests/e2e/runner.ts

import { runAllSuites } from './helpers/test-runner.ts';
import { ApiClient } from './helpers/api-client.ts';

async function main() {
  console.log('================================================================');
  console.log('🚀 PLATAFORMA DE ESTUDOS — SUÍTE DE TESTES E2E OPAQUE-BOX (FASES 1 & 2)');
  console.log('================================================================');

  const client = new ApiClient();
  console.log(`📡 URL Alvo da API: ${client.baseUrl}`);

  const isUp = await client.isHealthy();
  if (!isUp) {
    console.log(`⚠️  Servidor API não detectado em ${client.baseUrl}.`);
    console.log(`   (Os testes requerem o servidor API em execução para validação ao vivo.)`);
    console.log(`   Para iniciar o servidor: npm run dev:api ou verifique docker-compose.`);
  } else {
    console.log(`✅ Servidor API detectado e respondendo.`);
  }

  console.log('\nCarregando especificações de teste (Tiers 1-4)...');

  // Import all test suites to register them in the runner
  await import('./tier1-feature-coverage.test.ts');
  await import('./tier2-boundary-corner-cases.test.ts');
  await import('./tier3-cross-feature-combinations.test.ts');
  await import('./tier4-real-world-scenarios.test.ts');

  const startTime = Date.now();
  const results = await runAllSuites();
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);

  console.log('\n================================================================');
  console.log('📊 RESUMO DA EXECUÇÃO DOS TESTES E2E');
  console.log('================================================================');
  console.log(`Total de testes: ${results.total}`);
  console.log(`\x1b[32mSucessos:       ${results.passed}\x1b[0m`);
  if (results.failed > 0) {
    console.log(`\x1b[31mFalhas:         ${results.failed}\x1b[0m`);
  } else {
    console.log(`Falhas:         0`);
  }
  console.log(`Tempo total:    ${duration}s`);
  console.log('================================================================\n');

  if (results.failed > 0) {
    console.error(`\x1b[31m❌ Execução finalizada com ${results.failed} falha(s).\x1b[0m\n`);
    process.exit(1);
  } else {
    console.log(`\x1b[32m✔ Todos os ${results.passed} testes passaram com sucesso!\x1b[0m\n`);
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\x1b[31mErro fatal ao executar a suíte de testes:\x1b[0m', err);
  process.exit(1);
});
