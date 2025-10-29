/**
 * Custom error types for the Personal AI Assistant backend
 * Provides structured error handling with status codes
 */

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly isOperational: boolean;

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;

    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this);
  }
}

/**
 * 401 Unauthorized - Authentication failed or missing
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Authentication required') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

/**
 * 403 Forbidden - User lacks permission for resource
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Access forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

/**
 * 400 Bad Request - Invalid input or validation failed
 */
export class ValidationError extends AppError {
  constructor(message: string = 'Validation failed') {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

/**
 * 404 Not Found - Resource does not exist
 */
export class NotFoundError extends AppError {
  constructor(message: string = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

/**
 * 429 Too Many Requests - Rate limit exceeded
 */
export class RateLimitError extends AppError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429);
    this.name = 'RateLimitError';
  }
}

/**
 * 503 Service Unavailable - External service failure
 */
export class ExternalServiceError extends AppError {
  public readonly service: string;

  constructor(service: string, message: string = 'External service unavailable') {
    super(`${service}: ${message}`, 503);
    this.name = 'ExternalServiceError';
    this.service = service;
  }
}

/**
 * 402 Payment Required - Budget limit exceeded
 */
export class BudgetExceededError extends AppError {
  public readonly currentCost: number;
  public readonly limit: number;

  constructor(currentCost: number, limit: number = 10.0) {
    super(
      `Monthly budget limit of $${limit} exceeded (current: $${currentCost.toFixed(2)})`,
      402
    );
    this.name = 'BudgetExceededError';
    this.currentCost = currentCost;
    this.limit = limit;
  }
}

/**
 * 500 Internal Server Error - Unexpected error
 */
export class InternalServerError extends AppError {
  constructor(message: string = 'Internal server error') {
    super(message, 500, false); // Not operational - unexpected
    this.name = 'InternalServerError';
  }
}

/**
 * Error response formatter for API responses
 */
export interface ErrorResponse {
  error: {
    name: string;
    message: string;
    statusCode: number;
    timestamp: string;
    path?: string;
  };
}

/**
 * Format error for API response
 */
export function formatErrorResponse(error: AppError, path?: string): ErrorResponse {
  return {
    error: {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString(),
      path,
    },
  };
}
