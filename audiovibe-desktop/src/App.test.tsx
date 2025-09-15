import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renders AudioVibe title', () => {
    render(<App />)
    expect(screen.getByText('AudioVibe')).toBeInTheDocument()
  })

  it('renders welcome message', () => {
    render(<App />)
    expect(screen.getByText('Welcome to AudioVibe')).toBeInTheDocument()
  })

  it('renders Tauri connection test form', () => {
    render(<App />)
    expect(screen.getByText('Test Tauri Connection')).toBeInTheDocument()
    expect(screen.getByPlaceholderText('Enter your name...')).toBeInTheDocument()
  })
})