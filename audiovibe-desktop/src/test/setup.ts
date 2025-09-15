import '@testing-library/jest-dom'
import { vi, beforeEach } from 'vitest'

// Mock Tauri API for testing
const mockInvoke = vi.fn()
const mockListen = vi.fn()

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: mockListen,
}))

// Reset mocks before each test
beforeEach(() => {
  mockInvoke.mockReset()
  mockListen.mockReset()
})