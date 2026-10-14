import { SafeUser } from './auth.types.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      user?: SafeUser;
    }
  }
}
