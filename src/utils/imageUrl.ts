/**
 * Sanitize DOI for use in filename (replace / with _)
 */
export function sanitizeDoi(doi: string): string {
  return doi.replace(/\//g, '_')
}

/**
 * Get the R2 image URL for a given DOI
 */
export function getImageUrl(doi: string): string {
  const r2Domain = import.meta.env.VITE_R2_PUBLIC_DOMAIN
  if (!r2Domain) {
    console.warn('VITE_R2_PUBLIC_DOMAIN is not configured')
    return ''
  }
  const sanitized = sanitizeDoi(doi)
  return `https://${r2Domain}/images/${sanitized}.png`
}
