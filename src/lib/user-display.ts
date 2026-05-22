interface UserDisplayLike {
  full_name?: string | null
  email?: string | null
}

function normalizeInput(value?: string | null): string | null {
  if (!value) {
    return null
  }

  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function formatEmailAccount(value?: string | null): string {
  const normalized = normalizeInput(value)
  if (!normalized) {
    return ''
  }

  const [account] = normalized.split('@')
  return account || normalized
}

export function formatDisplayName(name?: string | null, email?: string | null, fallback?: string | null): string {
  const normalizedName = normalizeInput(name)
  if (normalizedName) {
    return normalizedName.includes('@') ? formatEmailAccount(normalizedName) : normalizedName
  }

  const normalizedEmail = normalizeInput(email)
  if (normalizedEmail) {
    return formatEmailAccount(normalizedEmail)
  }

  const normalizedFallback = normalizeInput(fallback)
  if (normalizedFallback) {
    return normalizedFallback.includes('@') ? formatEmailAccount(normalizedFallback) : normalizedFallback
  }

  return '-'
}

export function formatUserOptionLabel(user: UserDisplayLike): string {
  return formatDisplayName(user.full_name, user.email)
}
