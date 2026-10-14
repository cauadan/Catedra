/**
 * Script de verificação de prontidão do PostgreSQL.
 * Utiliza apenas módulos nativos do Node.js (node:net) para funcionar
 * independentemente de dependências externas antes do 'npm install'.
 */
import net from 'node:net';

const host = process.env.DB_HOST || '127.0.0.1';
const port = parseInt(process.env.DB_PORT || '5432', 10);
const maxAttempts = 30;
let attempts = 0;

console.log(`[wait-for-db] Aguardando inicialização do PostgreSQL em ${host}:${port}...`);

function check() {
  attempts++;
  const socket = new net.Socket();
  socket.setTimeout(2000);

  socket.on('connect', () => {
    console.log(`[wait-for-db] Sucesso: PostgreSQL está pronto e acessível em ${host}:${port}!`);
    socket.destroy();
    process.exit(0);
  });

  socket.on('error', () => {
    socket.destroy();
    if (attempts >= maxAttempts) {
      console.error(`[wait-for-db] Erro: Tempo limite atingido (${maxAttempts}s) sem resposta do PostgreSQL.`);
      process.exit(1);
    }
    console.log(`[wait-for-db] Banco ainda não disponível. Tentativa ${attempts}/${maxAttempts}. Aguardando...`);
    setTimeout(check, 1000);
  });

  socket.on('timeout', () => {
    socket.destroy();
    if (attempts >= maxAttempts) {
      console.error(`[wait-for-db] Erro: Tempo esgotado (timeout) ao conectar com ${host}:${port}.`);
      process.exit(1);
    }
    console.log(`[wait-for-db] Timeout na tentativa ${attempts}/${maxAttempts}. Tentando novamente...`);
    setTimeout(check, 1000);
  });

  socket.connect(port, host);
}

check();
