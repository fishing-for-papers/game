import type { CaughtPaper } from '../types/gameState'
import type { Paper } from '../types/paper'

const normalizeBibTeXValue = (value: string) =>
  value
    .replace(/\\/g, '\\\\')
    .replace(/[{}]/g, '\\$&')
    .replace(/\s+/g, ' ')
    .trim()

const splitAuthors = (authors: string) =>
  authors
    .split(/\s*;\s*|\s*\|\s*|\s*\n\s*/)
    .map((author) => author.trim())
    .filter(Boolean)

const getCitationKeyBase = (paper: Paper) => {
  const authors = splitAuthors(paper.authorNamesDeduped || paper.authorNames)
  const firstAuthorSurname =
    authors[0]?.split(/\s+/).pop()?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'paper'
  const titleWord =
    paper.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .find((word) => word.length > 3) || 'entry'

  return `${firstAuthorSurname}${paper.year || 'n.d.'}${titleWord}`
}

const paperToBibTeX = (paper: Paper, citationKey: string) => {
  const authors = splitAuthors(paper.authorNamesDeduped || paper.authorNames)
  const fields: Array<[string, string | number | undefined]> = [
    ['title', paper.title],
    ['author', authors.length > 0 ? authors.join(' and ') : undefined],
    ['year', paper.year || undefined],
    ['booktitle', paper.conference || undefined],
    ['doi', paper.doi || undefined],
    ['abstract', paper.abstract || undefined],
    [
      'pages',
      paper.firstPage && paper.lastPage ? `${paper.firstPage}--${paper.lastPage}` : undefined,
    ],
  ]

  const serializedFields = fields
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => `  ${key} = {${normalizeBibTeXValue(String(value))}}`)
    .join(',\n')

  return `@inproceedings{${citationKey},\n${serializedFields}\n}`
}

export const generateBibTeXFromCaughtPapers = (caughtPapers: CaughtPaper[]) => {
  const uniquePapers = caughtPapers.filter((savedPaper, index, papers) => {
    const identifier = savedPaper.paper.doi || savedPaper.paper.title
    return (
      papers.findIndex(
        (paperEntry) => (paperEntry.paper.doi || paperEntry.paper.title) === identifier,
      ) === index
    )
  })

  const citationKeyCounts = new Map<string, number>()

  return uniquePapers
    .map(({ paper }) => {
      const baseKey = getCitationKeyBase(paper)
      const count = citationKeyCounts.get(baseKey) ?? 0
      citationKeyCounts.set(baseKey, count + 1)
      const citationKey = count === 0 ? baseKey : `${baseKey}${count + 1}`
      return paperToBibTeX(paper, citationKey)
    })
    .join('\n\n')
}

export const exportCaughtPapersAsBibTeX = (
  caughtPapers: CaughtPaper[],
  filenamePrefix = 'fishing-game-gallery',
) => {
  const bibtex = generateBibTeXFromCaughtPapers(caughtPapers)
  if (!bibtex) {
    return false
  }

  const blob = new Blob([bibtex], { type: 'application/x-bibtex;charset=utf-8' })
  const downloadUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const dateStamp = new Date().toISOString().slice(0, 10)

  link.href = downloadUrl
  link.download = `${filenamePrefix}-${dateStamp}.bib`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(downloadUrl)

  return true
}
