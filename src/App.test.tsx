import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

describe('App', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it('updates totals when adding an expense', async () => {
    const user = userEvent.setup()
    render(<App />)

    const startingAmount = screen.getByLabelText(/starting monthly amount/i)
    await user.clear(startingAmount)
    await user.type(startingAmount, '1000')

    await user.selectOptions(screen.getByLabelText(/expense bucket/i), 'food')
    await user.type(screen.getByLabelText(/expense amount/i), '50')
    await user.type(screen.getByLabelText(/expense note/i), 'Groceries')
    await user.click(screen.getByRole('button', { name: /add expense/i }))

    expect(screen.getAllByText('$950').length).toBeGreaterThan(0)
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/expense added/i)
  })

  it('tracks actual money earned from income entries', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getAllByLabelText(/income amount/i)[0], '1200')
    await user.type(screen.getAllByLabelText(/income note/i)[0], 'Paycheck')
    await user.click(screen.getAllByRole('button', { name: /add income/i })[0])

    expect(screen.getByText('Paycheck')).toBeInTheDocument()
    expect(screen.getAllByText('$1,200').length).toBeGreaterThan(0)
    expect(
      screen
        .getAllByRole('status')
        .some((node) => node.textContent?.match(/earned total updated/i)),
    ).toBe(true)
  })

  it('adds a recurring bill and marks it paid', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.type(screen.getAllByLabelText(/^bill name$/i)[0], 'Internet')
    await user.type(screen.getAllByLabelText(/^bill amount$/i)[0], '75')
    await user.clear(screen.getAllByLabelText(/bill due day/i)[0])
    await user.type(screen.getAllByLabelText(/bill due day/i)[0], '5')
    await user.click(screen.getAllByRole('button', { name: /add bill/i })[0])

    expect(screen.getByText('Internet')).toBeInTheDocument()
    expect(screen.getAllByText('$75').length).toBeGreaterThan(0)
    await user.click(screen.getByRole('button', { name: /mark paid/i }))

    expect(
      screen
        .getAllByRole('status')
        .some((node) => node.textContent?.match(/added to expenses/i)),
    ).toBe(true)
  })

  it('imports a valid export file', async () => {
    render(<App />)

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    const payload = JSON.stringify({
      version: 2,
      buckets: [{ id: 'food', name: 'Food', color: '#ff7a59', archived: false }],
      monthPlans: [],
      incomes: [],
      expenses: [],
      recurringBills: [],
      billMonthStates: [],
    })
    const file = new File([payload], 'budget.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', {
      value: async () => payload,
    })

    fireEvent.change(fileInput, { target: { files: [file] } })

    expect(await screen.findByText(/budget imported successfully/i)).toBeInTheDocument()
  })
})
