import 'dotenv/config';
import { prisma } from '../src/lib/prisma.js';
import { QuestionService } from '../src/services/question.service.js';

async function main() {
  console.log('[Seed] Iniciando seed de questões curadas para T.I. e Concursos...');
  const currentCount = await prisma.question.count();
  console.log(`[Seed] Questões atuais no banco: ${currentCount}`);

  if (currentCount > 0) {
    console.log('[Seed] O banco já possui questões. Inserindo novas/garantindo carga...');
  }

  const inserted = await QuestionService.forceSeed();
  const finalCount = await prisma.question.count();
  console.log(`[Seed] Sucesso! ${inserted} questões processadas. Total no acervo: ${finalCount}`);
}

main()
  .catch((err) => {
    console.error('[Seed] Falha na execução do seed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
