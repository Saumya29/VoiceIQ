import { Router } from 'express';
import TestsController from './tests.controller.js';

const router = Router();

router.post('/generate', TestsController.generate);
router.get('/runs', TestsController.listRuns);
router.get('/runs/:runId', TestsController.getRun);
router.put('/cases/:caseId', TestsController.updateTestCase);

export default router;
