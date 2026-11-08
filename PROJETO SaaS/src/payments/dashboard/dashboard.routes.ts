import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  return res.status(200).json({
    activeStudents: 0,
    workoutPlans: 0,
    sessions: {
      executed: 0,
      inProgress: 0,
      total: 0
    }
  });
});

export default router;