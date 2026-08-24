import type { SearchTypes } from '@medusajs/types'
import type { EnqueuedTask, Task, TaskStatus } from 'meilisearch'

export function toTaskStatus(status: TaskStatus): SearchTypes.SearchTaskStatus {
  switch (status) {
    case 'succeeded':
      return 'succeeded'
    case 'failed':
    case 'canceled':
      return 'failed'
    case 'processing':
      return 'processing'
    default:
      return 'enqueued'
  }
}

export function fromEnqueuedTask(task: EnqueuedTask): SearchTypes.SearchTask {
  return {
    id: String(task.taskUid),
    index: task.indexUid ?? undefined,
    status: toTaskStatus(task.status),
  }
}

export function fromSettledTask(task: Task): SearchTypes.SearchTask {
  return {
    id: String(task.uid),
    index: task.indexUid ?? undefined,
    status: toTaskStatus(task.status),
    error: task.error ? { message: task.error.message, code: task.error.code } : undefined,
  }
}
