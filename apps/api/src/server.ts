import dotenv from 'dotenv';
import { app } from './app.js';

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

const port = process.env.PORT || 3001;

app.listen(port, () => {
  console.log(`[API] Servidor iniciado com sucesso e ouvindo na porta ${port}`);
});
