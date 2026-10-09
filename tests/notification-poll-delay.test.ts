import { expect, test } from 'vitest';
import { notificationPollDelay } from '../desktop/frontend-spartan/src/features/tasks/notification-poll-delay';

test('quiet accounts slow down, active runs and backlog stay responsive', () => {
  expect(notificationPollDelay(false, 0, 0)).toBe(10000);
  expect(notificationPollDelay(true, 0, 0)).toBe(2000);
  expect(notificationPollDelay(false, 100, 0)).toBe(2000);
  expect(notificationPollDelay(undefined, 0, 0)).toBe(2000);
});

test('failures back off with a bounded retry and success resets it', () => {
  expect(notificationPollDelay(true, 0, 1)).toBe(4000);
  expect(notificationPollDelay(true, 0, 2)).toBe(8000);
  expect(notificationPollDelay(true, 0, 50)).toBe(30000);
  expect(notificationPollDelay(true, 0, 0)).toBe(2000);
});
