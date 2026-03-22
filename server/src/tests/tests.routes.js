import { Router } from 'express';
import TestsController from './tests.controller.js';

const router = Router();

router.post('/generate', TestsController.generate);
router.get('/runs', TestsController.listRuns);
router.get('/runs/:runId', TestsController.getRun);
router.put('/cases/:caseId', TestsController.updateTestCase);
router.get('/runs/:runId/stream', TestsController.stream);
router.post('/runs/:runId/execute', TestsController.execute);
router.post('/runs/:runId/retest', TestsController.retest);

export default router;
