import { expect, test } from 'vitest'
import { notificationLedger } from '../desktop/frontend-spartan/src/features/tasks/notification-ledger'

function storage() {
  const values = new Map<string, string>()
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } }
}

test('a reload cannot replay a finished event, including the inclusive poll boundary', () => {
  const disk = storage()
  const ledger = notificationLedger(disk, 'reload', 100)
  expect(ledger.consume('run:finished', 120)).toBe(true)
  const reloaded = notificationLedger(disk, 'reload', 200)
  expect(reloaded.cursor).toBe(120)
  expect(reloaded.consume('run:finished', 120)).toBe(false)
  expect(reloaded.consume('other:finished', 120)).toBe(true)
  expect(reloaded.consume('new:started', 201)).toBe(true)
  expect(reloaded.consume('run:finished', 120)).toBe(false)
})

test('legacy completed cursor is migrated without replaying the completed task', () => {
  const disk = storage()
  disk.setItem('sparta.automation-notifications.legacy', '120')
  const ledger = notificationLedger(disk, 'legacy', 200)
  expect(ledger.consume('old:finished', 120)).toBe(false)
  expect(ledger.consume('next:started', 121)).toBe(true)
})

test('two mounted consumers share consumption and accounts remain separate', () => {
  const disk = storage()
  const first = notificationLedger(disk, 'shared', 100)
  const second = notificationLedger(disk, 'shared', 100)
  expect(first.consume('run:finished', 120)).toBe(true)
  expect(second.consume('run:finished', 120)).toBe(false)
  expect(notificationLedger(disk, 'another-account', 100).consume('run:finished', 120)).toBe(true)
})

test('unavailable persistent storage still deduplicates component remounts', () => {
  const disk = { getItem: () => { throw new Error('unavailable') }, setItem: () => { throw new Error('unavailable') } }
  expect(notificationLedger(disk, 'unavailable', 100).consume('run:finished', 120)).toBe(true)
  expect(notificationLedger(disk, 'unavailable', 200).consume('run:finished', 120)).toBe(false)
})
