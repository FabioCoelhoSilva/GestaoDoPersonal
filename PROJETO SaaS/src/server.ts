import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { paymentRouter } from './payments/payment.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rota de Health Check totalmente isolada no topo
app.get('/health', (req, res) => {
  return res.status(200).json({ status: 'API is running successfully' });
});

app.use('/api/payments', paymentRouter);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
