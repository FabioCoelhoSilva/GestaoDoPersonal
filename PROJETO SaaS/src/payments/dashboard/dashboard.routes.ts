import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ status: 'Dashboard payments route active' });
});

export default router;
