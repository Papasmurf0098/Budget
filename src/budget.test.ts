import { describe, expect, it } from 'vitest'
import {
  addBucket,
  addExpense,
  addIncome,
  addRecurringBill,
  createInitialBudgetData,
  deriveMonthSnapshot,
  parseBudgetData,
  setBucketAllocation,
  setBucketRollover,
  setStartingAmount,
  toggleRecurringBillPaid,
} from './budget'

describe('budget calculations', () => {
  it('subtracts an expense from its bucket and monthly balance', () => {
    let data = createInitialBudgetData('2026-04')
    data = setStartingAmount(data, '2026-04', 500_00)
    data = setBucketAllocation(data, '2026-04', 'food', 200_00)
    data = addExpense(data, {
      monthKey: '2026-04',
      bucketId: 'food',
      amountCents: 42_50,
      date: '2026-04-02',
      note: 'Groceries',
      source: 'manual',
    })

    const snapshot = deriveMonthSnapshot(data, '2026-04')
    const foodBucket = snapshot.bucketSummaries.find((bucket) => bucket.bucket.id === 'food')

    expect(snapshot.totalSpentCents).toBe(42_50)
    expect(snapshot.availableRemainingCents).toBe(457_50)
    expect(foodBucket?.remainingCents).toBe(157_50)
  })

  it('adds recorded income to the actual earned total and available balance', () => {
    let data = createInitialBudgetData('2026-04')
    data = setStartingAmount(data, '2026-04', 100_00)
    data = addIncome(data, {
      monthKey: '2026-04',
      amountCents: 900_00,
      date: '2026-04-01',
      note: 'Paycheck',
    })
    data = addExpense(data, {
      monthKey: '2026-04',
      bucketId: 'food',
      amountCents: 50_00,
      date: '2026-04-02',
      note: 'Groceries',
      source: 'manual',
    })

    const snapshot = deriveMonthSnapshot(data, '2026-04')

    expect(snapshot.totalIncomeCents).toBe(900_00)
    expect(snapshot.availableRemainingCents).toBe(950_00)
  })

  it('calculates recurring bills and prevents duplicate paid entries', () => {
    let data = createInitialBudgetData('2026-04')
    data = addRecurringBill(data, {
      name: 'Internet',
      amountCents: 65_00,
      bucketId: 'utilities',
      dueDay: 4,
    })

    const billId = data.recurringBills[0].id
    data = toggleRecurringBillPaid(data, billId, '2026-04')
    data = toggleRecurringBillPaid(data, billId, '2026-04')
    data = toggleRecurringBillPaid(data, billId, '2026-04')

    const snapshot = deriveMonthSnapshot(data, '2026-04')

    expect(snapshot.requiredSpendCents).toBe(65_00)
    expect(snapshot.totalSpentCents).toBe(65_00)
    expect(snapshot.expenses).toHaveLength(1)
    expect(snapshot.billSummaries[0]?.state).toBe('paid')
  })

  it('applies manual rollover to bucket remaining', () => {
    let data = createInitialBudgetData('2026-04')
    data = setBucketAllocation(data, '2026-04', 'shopping', 150_00)
    data = setBucketRollover(data, '2026-04', 'shopping', 25_00)
    data = addExpense(data, {
      monthKey: '2026-04',
      bucketId: 'shopping',
      amountCents: 40_00,
      date: '2026-04-10',
      note: 'Shoes',
      source: 'manual',
    })

    const snapshot = deriveMonthSnapshot(data, '2026-04')
    const shoppingBucket = snapshot.bucketSummaries.find((bucket) => bucket.bucket.id === 'shopping')

    expect(shoppingBucket?.remainingCents).toBe(135_00)
  })

  it('validates imported data version and shape', () => {
    const exported = {
      version: 2,
      buckets: [{ id: 'food', name: 'Food', color: '#ff7a59', archived: false }],
      monthPlans: [],
      incomes: [],
      expenses: [],
      recurringBills: [],
      billMonthStates: [],
    }

    expect(parseBudgetData(exported).buckets).toHaveLength(1)
    expect(parseBudgetData({ ...exported, version: 1 }).incomes).toHaveLength(0)
    expect(() => parseBudgetData({ ...exported, version: 999 })).toThrow(/Expected version 2/)
    expect(() => parseBudgetData({ version: 2, buckets: [] })).toThrow(/include any buckets/)
  })

  it('creates custom buckets', () => {
    const data = addBucket(createInitialBudgetData('2026-04'), {
      name: 'Travel',
      color: '#0f9db6',
    })

    expect(data.buckets.some((bucket) => bucket.name === 'Travel')).toBe(true)
  })
})
