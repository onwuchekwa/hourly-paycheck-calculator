export type ApiErrorCode =
  | 'unauthenticated'
  | 'permission-denied'
  | 'invalid-argument'
  | 'already-exists'
  | 'not-found'
  | 'failed-precondition'
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

  static internal(message = 'Something went wrong. Please try again.') {
    return new ApiError('internal', message, 500)
  }
}
