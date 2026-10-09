import { afterEach, describe, expect, test, vi } from "vitest";
import { createRunPoller } from "../desktop/frontend-spartan/src/features/tasks/shared-run-poller";

afterEach(() => vi.useRealTimers());
describe("shared automation execution subscriptions", () => {
  test("visibility refresh wakes a delayed run without restarting terminal runs", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce({ id: "run", status: "running" })
      .mockResolvedValue({ id: "run", status: "completed" });
    const subscribe = createRunPoller(fetch, () => 10000);
    const off = subscribe("thread", vi.fn());
    await vi.advanceTimersByTimeAsync(0);
    subscribe.refresh();
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(2);
    subscribe.refresh();
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetch).toHaveBeenCalledTimes(2); off();
  });
  test("two consumers share requests and a terminal run stops polling", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockResolvedValueOnce({ id: "run", status: "running" })
      .mockResolvedValue({ id: "run", status: "completed" });
    const subscribe = createRunPoller(fetch, () => 1000);
    const chat = vi.fn(); const controls = vi.fn();
    const offChat = subscribe("thread", chat); const offControls = subscribe("thread", controls);
    await vi.advanceTimersByTimeAsync(0);
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(chat).toHaveBeenCalledTimes(1); expect(controls).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1000);
    expect(fetch).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetch).toHaveBeenCalledTimes(2);
    offChat(); offControls();
  });
  test("unmount suppresses late responses and resubscription fetches fresh state", async () => {
    vi.useFakeTimers();
    let resolve!: (value: { id: string; status: string }) => void;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r; }))
      .mockResolvedValue({ id: "new", status: "cancelled" });
    const subscribe = createRunPoller(fetch, () => 1000);
    const listener = vi.fn(); const off = subscribe("thread", listener);
    off(); resolve({ id: "old", status: "running" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(listener).not.toHaveBeenCalled();
    const offNew = subscribe("thread", listener);
    await vi.advanceTimersByTimeAsync(0);
    expect(listener).toHaveBeenCalledWith({ id: "new", status: "cancelled" }); offNew();
  });
  test("network errors retry and one failing consumer cannot block another", async () => {
    vi.useFakeTimers();
    const fetch = vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ id: "run", status: "running" });
    const subscribe = createRunPoller(fetch, () => 1000);
    const good = vi.fn();
    const offBad = subscribe("thread", async () => { throw new Error("view failed"); });
    const offGood = subscribe("thread", good);
    await vi.advanceTimersByTimeAsync(1000);
    expect(good).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledTimes(2); offBad(); offGood();
  });
  test("does not overlap requests and adjusts delay between observations", async () => {
    vi.useFakeTimers();
    let resolve!: (value: { id: string; status: string }) => void;
    let delay = 1000;
    const fetch = vi.fn().mockImplementationOnce(() => new Promise(r => { resolve = r; }))
      .mockResolvedValue({ id: "run", status: "running" });
    const subscribe = createRunPoller(fetch, () => delay);
    const off = subscribe("thread", vi.fn());
    await vi.advanceTimersByTimeAsync(10000);
    expect(fetch).toHaveBeenCalledTimes(1);
    delay = 10000; resolve({ id: "run", status: "running" });
    await vi.advanceTimersByTimeAsync(9999);
    expect(fetch).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(fetch).toHaveBeenCalledTimes(2); off();
  });
});
