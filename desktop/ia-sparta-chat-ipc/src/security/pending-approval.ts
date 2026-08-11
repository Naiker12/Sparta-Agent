import type { PermissionResponse } from 'ia-sparta-contracts'

export class PendingApprovalStore {
  private readonly pending = new Map<string, (response: PermissionResponse) => void>()

  waitFor(requestId: string): Promise<PermissionResponse> {
    if (this.pending.has(requestId)) throw new Error(`Permission request already pending: ${requestId}`)
    return new Promise((resolve) => this.pending.set(requestId, resolve))
  }

  respond(requestId: string, response: PermissionResponse): boolean {
    const resolve = this.pending.get(requestId)
    if (!resolve) return false
    this.pending.delete(requestId)
    resolve(response)
    return true
  }
}
