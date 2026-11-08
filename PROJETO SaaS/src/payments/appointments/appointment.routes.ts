import { Router } from 'express';
export const appointmentRouter = Router();
appointmentRouter.get('/', (req, res) => res.json({ status: 'Appointment payment routes active' }));
