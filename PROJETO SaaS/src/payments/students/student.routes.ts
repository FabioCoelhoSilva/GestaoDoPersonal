import { Router } from 'express';
const router = Router();
router.get('/', (req, res) => res.json({ status: 'Student payment routes active' }));
export default router;
