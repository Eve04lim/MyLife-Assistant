// App コンポーネントのサンプルテスト
import { render, screen } from '@testing-library/react'
import App from '../App'

describe('App', () => {
  test('renders app component with buttons', () => {
    // App コンポーネントをレンダリング
    render(<App />)
    
    // "Click me" ボタンが表示されることを確認
    const clickButton = screen.getByText('Click me')
    expect(clickButton).toBeInTheDocument()
  })

  test('renders secondary button', () => {
    render(<App />)
    
    // "Secondary" ボタンが存在することを確認
    const secondaryButton = screen.getByRole('button', { name: 'Secondary' })
    expect(secondaryButton).toBeInTheDocument()
  })
})