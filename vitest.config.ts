import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    pool: 'forks',
    // Offline tests import modules that initialize Firebase at load time. CI
    // does not inject production secrets into the test step, so use the same
    // demo config as local emulator development.
    env: {
      VITE_USE_FIREBASE_EMULATORS: 'true',
    },
  },
})
