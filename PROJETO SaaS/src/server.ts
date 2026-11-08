import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import dashboardRouter from './payments/dashboard/dashboard.routes';

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
// 2. ROTA DE MÉTRICAS DO DASHBOARD
// ==========================================
app.use('/api/dashboard', dashboardRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});