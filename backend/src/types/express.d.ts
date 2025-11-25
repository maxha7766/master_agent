/**
 * Express Type Extensions
 * Extends Express Request interface to include custom properties
 */

import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
      };
    }
  }
}
