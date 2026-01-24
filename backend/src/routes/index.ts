import { Router } from 'express';
import authRoutes from './auth';
import pagesRoutes from './pages';
import postsRoutes from './posts';
import campaignsRoutes from './campaigns';
import formsRoutes from './forms';
import usersRoutes from './users';
import messagesRoutes from './messages';
import mediaRoutes from './media';
import socialRoutes from './social';
import settingsRoutes from './settings';
import searchRoutes from './search';
import healthRoutes from './health';

const router = Router();

router.use('/auth', authRoutes);
router.use('/pages', pagesRoutes);
router.use('/posts', postsRoutes);
router.use('/campaigns', campaignsRoutes);
router.use('/forms', formsRoutes);
router.use('/users', usersRoutes);
router.use('/messages', messagesRoutes);
router.use('/media', mediaRoutes);
router.use('/social', socialRoutes);
router.use('/settings', settingsRoutes);
router.use('/search', searchRoutes);
router.use('/health', healthRoutes);

export default router;
