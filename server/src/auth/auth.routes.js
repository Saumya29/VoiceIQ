import { Router } from 'express';
import AuthController from './auth.controller.js';

const router = Router();

router.get('/install', AuthController.install);
router.get('/callback', AuthController.callback);
router.get('/status', AuthController.status);

export default router;
