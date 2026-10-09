import { afterEach, expect, test, vi } from 'vitest';
import { readSpreadsheetAttachment, SpreadsheetAttachmentAdapter, spreadsheetAttachmentText } from '../desktop/frontend-spartan/src/features/chat/spreadsheet-attachment-adapter';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

test('adding is cheap, send preserves metadata and cancellation discards a late reader result', async () => {
  const read = vi.fn(async () => 'Concepto\tValor\nSpartan\t42');
  const adapter = new SpreadsheetAttachmentAdapter(read);
  const file = new File(['fixture'], 'report.xlsx');
  const pending = await adapter.add({ file });
  expect(read).not.toHaveBeenCalled();
  const complete = await adapter.send(pending);
  expect(complete.id).toBe(pending.id);
  expect(complete.content[0]).toEqual({ type: 'text', text: '[Spreadsheet: report.xlsx]\nConcepto\tValor\nSpartan\t42' });
  let release!: (text: string) => void;
  const slow = new SpreadsheetAttachmentAdapter(() => new Promise(resolve => { release = resolve; }));
  const slowPending = await slow.add({ file });
  const sent = slow.send(slowPending);
  const rejected = expect(sent).rejects.toMatchObject({ name: 'AbortError' });
  await slow.remove(slowPending);
  release('late');
  await rejected;
});

test('all sheets retain labels and numbers, with explicit limits and parse errors', () => {
  expect(spreadsheetAttachmentText({ sheets: [
    { name: 'Data', rows: [['Spartan', '42']], truncated: false },
    { name: 'Empty', rows: [], truncated: false },
  ] })).toContain('[Sheet: Data]\nSpartan\t42\n\n[Sheet: Empty]');
  const result = spreadsheetAttachmentText({ sheets: [{ name: 'Large', rows: [['x'.repeat(110000)]], truncated: false }] });
  expect(result.length).toBeLessThan(100100);
  expect(result).toContain('Partial spreadsheet');
  expect(() => spreadsheetAttachmentText({ sheets: [], error: 'Invalid workbook' })).toThrow('Invalid workbook');
});

test('worker terminates on success, cancellation and timeout without retaining timers', async () => {
  vi.useFakeTimers();
  const workers: FakeWorker[] = [];
  class FakeWorker {
    onmessage?: (event: { data: unknown }) => void;
    onerror?: () => void;
    terminate = vi.fn();
    postMessage = vi.fn();
    constructor() { workers.push(this); }
  }
  vi.stubGlobal('Worker', FakeWorker);
  const file = new File(['fixture'], 'report.xlsx');
  const success = readSpreadsheetAttachment(file, new AbortController().signal);
  workers[0].onmessage?.({ data: { sheets: [{ name: 'Data', rows: [['42']], truncated: false }] } });
  expect(await success).toContain('42');
  expect(workers[0].terminate).toHaveBeenCalledOnce();
  const controller = new AbortController();
  const cancelled = readSpreadsheetAttachment(file, controller.signal);
  const cancellation = expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
  controller.abort();
  await cancellation;
  expect(workers[1].terminate).toHaveBeenCalledOnce();
  const timedOut = readSpreadsheetAttachment(file, new AbortController().signal);
  const failure = expect(timedOut).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(15000);
  await failure;
  expect(workers[2].terminate).toHaveBeenCalledOnce();
  expect(vi.getTimerCount()).toBe(0);
});
