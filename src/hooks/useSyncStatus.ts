import { useSyncExternalStore } from 'react'
import { getSyncStatus, subscribeSyncStatus, type SyncStatus } from '../lib/syncEngine'

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus)
}
