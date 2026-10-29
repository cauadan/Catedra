import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware.js';
import { TopicController } from '../controllers/topic.controller.js';

export const topicRouter = Router();

topicRouter.use(authMiddleware);

topicRouter.get('/', TopicController.listTopics);
topicRouter.post('/', TopicController.createTopic);
topicRouter.patch('/:id/toggle-completed', TopicController.toggleCompleted);
topicRouter.patch('/:id', TopicController.updateTopic);
topicRouter.delete('/:id', TopicController.deleteTopic);
