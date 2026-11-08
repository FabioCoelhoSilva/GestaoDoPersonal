import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { paymentRouter } from './payments/payment.routes'; // Ajuste o caminho se necessário para o local onde guardou este ficheiro

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ==========================================
// 1. ROTA PÚBLICA DE HEALTH CHECK
// ==========================================
app.get('/health', (req, res) => {
  return res.status(200).json({ status: 'API is running successfully' });
});

// ==========================================
// 2. ROTAS PRINCIPAIS DA API (Centralizadas)
// ==========================================
// Como o seu paymentRouter já aplica internamente o supabaseAuthMiddleware,
// as rotas em /api herdam essa proteção.
app.use('/api', paymentRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});