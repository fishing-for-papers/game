export interface Paper {
  x: number
  y: number
  cluster: number
  conference: string
  year: number
  title: string
  doi: string
  link: string
  firstPage: string
  lastPage: string
  paperType: string
  abstract: string
  authorNamesDeduped: string
  authorNames: string
  authorAffiliation: string
  internalReferences: string
  authorKeywords: string
  aminerCitationCount: number
  citationCountCrossRef: number
  pubsCitedCrossRef: string
  downloadsXplore: number
  award: string
  graphicsReplicabilityStamp: string
  score: number
  keywords?: string[]
  usedKeyworm?: string[]
}
