export { connect, isConnected, addEntry, updateEntry, deleteEntry, search, count as getIndexedCount, deleteAll } from './chroma-client'
export { setActiveProvider, getActiveProvider, embed, embedBatch, getEmbeddingModelLabel } from './embeddings'
export { semanticSearch, buildMemoryContext } from './semantic-search'
export type { SemanticSearchResult } from './semantic-search'
