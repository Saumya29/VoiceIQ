import { Router } from 'express';
import AgentsController from './agents.controller.js';

const router = Router();

router.get('/', AgentsController.list);
router.get('/:agentId', AgentsController.getById);

export default router;
