export { connect, isConnected, addEntry, updateEntry, deleteEntry, count as getIndexedCount, deleteAll, searchByQuery } from './chroma-client'
export { embed, embedBatch, setActiveProvider, getActiveProvider, getEmbeddingModelLabel } from './embeddings'
export { semanticSearch, buildMemoryContext } from './semantic-search'
export type { SemanticSearchResult } from './semantic-search'
