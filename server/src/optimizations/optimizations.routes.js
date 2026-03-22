import { Router } from 'express';
import OptimizationsController from './optimizations.controller.js';

const router = Router();

router.post('/generate', OptimizationsController.generate);
router.get('/', OptimizationsController.list);
router.get('/:optimizationId', OptimizationsController.getById);
router.post('/:optimizationId/approve', OptimizationsController.approve);
router.post('/:optimizationId/apply', OptimizationsController.apply);
router.post('/:optimizationId/reject', OptimizationsController.reject);

export default router;
