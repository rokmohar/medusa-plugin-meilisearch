export function toError(value: unknown): Error {
  if (value instanceof Error) {
    return value
  }

  if (typeof value === 'string') {
    return new Error(value)
  }

  if (value !== null && typeof value === 'object') {
    if ('message' in value && typeof value.message === 'string') {
      return new Error(value.message, { cause: value })
    }

    try {
      return new Error(JSON.stringify(value), { cause: value })
    } catch {
      return new Error(String(value), { cause: value })
    }
  }

  return new Error(String(value))
}
