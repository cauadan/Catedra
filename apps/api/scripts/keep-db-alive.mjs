import { spawn, execSync } from 'node:child_process';
import net from 'node:net';

console.log('[keep-db-alive] Iniciando guardião do Docker e PostgreSQL...');

// Spawna Docker Desktop
const dockerProc = spawn('C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe', [], {
  detached: true,
  stdio: 'ignore',
});
dockerProc.unref();
console.log('[keep-db-alive] Docker Desktop disparado com PID:', dockerProc.pid);

// Aguarda daemon do Docker
let dockerPronto = false;
for (let i = 1; i <= 30; i++) {
  try {
    const v = execSync('docker version', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
    if (v.includes('Server:')) {
      dockerPronto = true;
      console.log(`[keep-db-alive] Docker Server pronto na tentativa ${i}!`);
      break;
    }
  } catch {
    // aguarda
  }
  await new Promise((r) => setTimeout(r, 2000));
}

if (dockerPronto) {
  try {
    console.log('[keep-db-alive] Executando docker compose up -d...');
    const up = execSync('docker compose up -d', { encoding: 'utf-8' });
    console.log('[keep-db-alive] docker compose:\n', up);
  } catch (err) {
    console.error('[keep-db-alive] Erro ao subir docker compose:', err.message);
  }

  // Verifica porta 5432
  for (let j = 1; j <= 15; j++) {
    const connected = await new Promise((resolve) => {
      const sock = new net.Socket();
      sock.setTimeout(1500);
      sock.on('connect', () => {
        sock.destroy();
        resolve(true);
      });
      sock.on('error', () => {
        sock.destroy();
        resolve(false);
      });
      sock.on('timeout', () => {
        sock.destroy();
        resolve(false);
      });
      sock.connect(5432, '127.0.0.1');
    });

    if (connected) {
      console.log(`[keep-db-alive] PostgreSQL 16 PRONTO e escutando em 127.0.0.1:5432!`);
      break;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
} else {
  console.warn('[keep-db-alive] Docker Server não respondeu no tempo limite.');
}

// Mantém o processo daemon vivo
console.log('[keep-db-alive] Guardião em execução contínua (daemon ativo)...');
setInterval(() => {
  // Heartbeat do daemon
}, 30000);
