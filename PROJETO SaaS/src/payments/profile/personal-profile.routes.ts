import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.json({ status: 'Personal profile payment routes active' });
});

export default router;
