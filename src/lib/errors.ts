import { FirebaseError } from 'firebase/app'

const CALLABLE_MESSAGES: Record<string, string> = {
  'functions/already-exists': 'An account with this email already exists.',
  'functions/invalid-argument': 'Please check the form and try again.',
  'functions/permission-denied': 'You do not have permission to perform this action.',
  'functions/unauthenticated': 'Please sign in again.',
  'functions/not-found': 'The requested item was not found.',
  'functions/failed-precondition': 'This action cannot be completed right now.',
}

export function getCallableErrorMessage(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (err instanceof FirebaseError) {
    return CALLABLE_MESSAGES[err.code] ?? err.message ?? fallback
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  return fallback
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
