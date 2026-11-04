import { Pool } from 'pg';
import 'dotenv/config';

// Configuração do pool de ligações à base de dados PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('Query executada com sucesso', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('Erro ao executar query na base de dados', { text, error });
    throw error;
  }
};