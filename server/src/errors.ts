export type ApiErrorCode =
  | 'unauthenticated'
  | 'permission-denied'
  | 'invalid-argument'
  | 'already-exists'
  | 'not-found'
  | 'failed-precondition'
  | 'resource-exhausted'
  | 'internal'

export class ApiError extends Error {
  constructor(
    public code: ApiErrorCode,
    message: string,
    public status = 500,
  ) {
    super(message)
    this.name = 'ApiError'
  }

  static unauthenticated(message = 'Authentication required.') {
    return new ApiError('unauthenticated', message, 401)
  }

  static permissionDenied(message = 'You do not have permission to perform this action.') {
    return new ApiError('permission-denied', message, 403)
  }

  static invalidArgument(message = 'Please check the form and try again.') {
    return new ApiError('invalid-argument', message, 400)
  }

  static alreadyExists(message = 'An account with this email already exists.') {
    return new ApiError('already-exists', message, 409)
  }

  static notFound(message = 'The requested item was not found.') {
    return new ApiError('not-found', message, 404)
  }

  static failedPrecondition(message = 'This action cannot be completed right now.') {
    return new ApiError('failed-precondition', message, 412)
  }

  static resourceExhausted(
    message = 'Database quota exceeded. Wait a few minutes and try again.',
  ) {
    return new ApiError('resource-exhausted', message, 429)
  }

  static internal(message = 'Something went wrong. Please try again.') {
    return new ApiError('internal', message, 500)
  }
}

/** Maps Firestore/gRPC failures to user-facing API errors. */
export function mapFirestoreError(err: unknown): ApiError {
  const message = err instanceof Error ? err.message : String(err)
  if (message.includes('RESOURCE_EXHAUSTED')) {
    return ApiError.resourceExhausted(
      'Database quota exceeded. Wait a few minutes and try again. If this persists, upgrade your Firebase plan.',
    )
  }
  if (message.includes('FAILED_PRECONDITION') && message.toLowerCase().includes('index')) {
    return ApiError.failedPrecondition(
      'A required database index is still building. Try again in a few minutes.',
    )
  }
  return ApiError.internal(message)
}
