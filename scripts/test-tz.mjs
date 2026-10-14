/**
 * Executa toda a suíte do Vitest sob o fuso Asia/Tokyo (UTC+9), de forma
 * compatível com Windows/PowerShell (não depende de `TZ=... comando` do shell).
 * TZ é definido no ambiente ANTES de o Node do Vitest iniciar, e `--pool=forks`
 * garante que os workers herdem a variável.
 */
import { spawnSync } from 'node:child_process';

const env = { ...process.env, TZ: 'Asia/Tokyo', TZ_TEST: '1' };
const extraArgs = process.argv.slice(2);

const result = spawnSync('npx', ['vitest', 'run', '--pool=forks', ...extraArgs], {
  stdio: 'inherit',
  shell: true,
  env,
});

process.exit(result.status ?? 1);
