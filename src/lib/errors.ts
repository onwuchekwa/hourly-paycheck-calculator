import { FirebaseError } from 'firebase/app'

export class ApiClientError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiClientError'
    this.code = code
  }
}

const CALLABLE_MESSAGES: Record<string, string> = {
  'functions/already-exists': 'An account with this email already exists.',
  'functions/invalid-argument': 'Please check the form and try again.',
  'functions/permission-denied': 'You do not have permission to perform this action.',
  'functions/unauthenticated': 'Please sign in again.',
  'functions/not-found': 'The requested item was not found.',
  'functions/failed-precondition': 'This action cannot be completed right now.',
  'already-exists': 'An account with this email already exists.',
  'invalid-argument': 'Please check the form and try again.',
  'permission-denied': 'You do not have permission to perform this action.',
  'unauthenticated': 'Please sign in again.',
  'not-found': 'The requested item was not found.',
  'failed-precondition': 'This action cannot be completed right now.',
  internal: 'Something went wrong. Please try again.',
}

export function getCallableErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof ApiClientError) {
    const generic = CALLABLE_MESSAGES[err.code]
    if (err.message && err.message !== generic && err.message !== 'Request failed.') {
      return err.message
    }
    return generic ?? err.message ?? fallback
  }
  if (err instanceof FirebaseError) {
    return CALLABLE_MESSAGES[err.code] ?? err.message ?? fallback
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  return fallback
}

export function getPasswordChangeErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
        return 'Current password is incorrect.'
      case 'auth/weak-password':
        return 'New password is too weak. Choose a longer, less common password.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.'
      default:
        return 'Unable to change password. Please try again.'
    }
  }
  return 'Unable to change password. Please try again.'
}

export function getAuthErrorMessage(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Invalid email or password. Please try again.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a moment and try again.'
      case 'auth/user-disabled':
        return 'This account has been disabled. Contact your employer.'
      default:
        return err.message
    }
  }
  return 'Sign in failed. Please try again.'
}
