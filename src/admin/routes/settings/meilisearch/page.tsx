import { Button, Container, Heading, Badge, Text, Switch, Input } from '@medusajs/ui'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from '@medusajs/ui'
import { defineRouteConfig } from '@medusajs/admin-sdk'
import { useState } from 'react'

interface VectorSearchStatus {
  enabled: boolean
  provider?: string
  model?: string
  dimensions?: number
  embeddingFields: string[]
  semanticRatio: number
}

const SyncPage = () => {
  const [semanticSearchEnabled, setSemanticSearchEnabled] = useState(false)
  const [semanticRatio, setSemanticRatio] = useState(0.5)
  const [searchQuery, setSearchQuery] = useState('test product')

  // Query to get vector search status
  const { data: vectorStatus, isLoading: statusLoading, error: statusError, refetch: refetchStatus } = useQuery<VectorSearchStatus>({
    queryKey: ['meilisearch-vector-status'],
    queryFn: async () => {
      const response = await fetch('/admin/meilisearch/vector-status')
      if (!response.ok) {
        throw new Error(`Failed to fetch vector search status: ${response.status}`)
      }
      return response.json()
    },
    retry: 2,
    staleTime: 30000, // Consider data stale after 30 seconds
  })

  const { mutate: syncData, isPending: syncPending } = useMutation({
    mutationFn: () =>
      fetch('/admin/meilisearch/sync', {
        method: 'POST',
      }),
    onSuccess: () => {
      toast.success('Successfully triggered data sync to Meilisearch')
    },
    onError: (err) => {
      console.error(err)
      toast.error('Failed to sync data to Meilisearch')
    },
  })

  const { mutate: testSearch, isPending: testPending } = useMutation({
    mutationFn: async () => {
      if (!searchQuery.trim()) {
        throw new Error('Search query cannot be empty')
      }
      
      const response = await fetch('/admin/meilisearch/hits', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: searchQuery.trim(),
          semanticSearch: semanticSearchEnabled,
          semanticRatio: semanticRatio,
          limit: 5,
          offset: 0,
        }),
      })
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`Search test failed: ${errorData.message || response.statusText}`)
      }
      
      return response.json()
    },
    onSuccess: (data) => {
      const hybridInfo = data.hybridSearch ? ` (hybrid search with ratio ${data.semanticRatio})` : ''
      toast.success(`Search test successful! Found ${data.hits.length} results${hybridInfo}`)
    },
    onError: (err: Error) => {
      console.error('Search test error:', err)
      toast.error(err.message || 'Search test failed')
    },
  })

  const handleSync = () => {
    syncData()
  }

  const handleTestSearch = () => {
    testSearch()
  }

  return (
    <Container>
      <div className="flex flex-col gap-y-6">
        <div>
          <Heading level="h1">Meilisearch Configuration</Heading>
          <Text className="text-gray-500 mt-2">
            Manage your Meilisearch index synchronization and AI-powered semantic search settings.
          </Text>
        </div>

        {/* Vector Search Status */}
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Heading level="h2">AI-Powered Semantic Search</Heading>
              {statusLoading ? (
                <Badge>Loading...</Badge>
              ) : statusError ? (
                <Badge color="red">Error</Badge>
              ) : vectorStatus?.enabled ? (
                <Badge color="green">Enabled</Badge>
              ) : (
                <Badge color="grey">Disabled</Badge>
              )}
            </div>
            <Button 
              variant="secondary" 
              size="small" 
              onClick={() => refetchStatus()}
              isLoading={statusLoading}
            >
              Refresh Status
            </Button>
          </div>

          {statusError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <Text className="text-red-800 text-sm">
                Failed to load vector search status: {statusError.message}
              </Text>
            </div>
          )}

          {vectorStatus?.enabled && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <Text className="text-sm font-medium text-gray-700">Provider</Text>
                <Text className="text-sm text-gray-600">{vectorStatus.provider || 'Not specified'}</Text>
              </div>
              <div>
                <Text className="text-sm font-medium text-gray-700">Model</Text>
                <Text className="text-sm text-gray-600">{vectorStatus.model || 'Not specified'}</Text>
              </div>
              {vectorStatus.dimensions && (
                <div>
                  <Text className="text-sm font-medium text-gray-700">Vector Dimensions</Text>
                  <Text className="text-sm text-gray-600">{vectorStatus.dimensions}</Text>
                </div>
              )}
              <div>
                <Text className="text-sm font-medium text-gray-700">Embedding Fields</Text>
                <Text className="text-sm text-gray-600">{vectorStatus.embeddingFields.join(', ')}</Text>
              </div>
            </div>
          )}

          {vectorStatus?.enabled && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Text className="font-medium">Enable Semantic Search in Tests</Text>
                  <Text className="text-sm text-gray-500">Use AI-powered semantic search for better results</Text>
                </div>
                <Switch
                  checked={semanticSearchEnabled}
                  onCheckedChange={setSemanticSearchEnabled}
                />
              </div>

              {semanticSearchEnabled && (
                <div>
                  <Text className="font-medium mb-2">Semantic Ratio: {semanticRatio}</Text>
                  <Text className="text-sm text-gray-500 mb-3">
                    0.0 = Pure keyword search, 1.0 = Pure semantic search, 0.5 = Balanced hybrid
                  </Text>
                  <div className="flex items-center gap-2">
                    <Input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={semanticRatio}
                      onChange={(e) => setSemanticRatio(parseFloat(e.target.value))}
                      className="flex-1"
                      aria-label="Semantic search ratio"
                      aria-describedby="semantic-ratio-description"
                    />
                    <span className="text-sm text-gray-700">{semanticRatio.toFixed(1)}</span>
                  </div>
                  <div id="semantic-ratio-description" className="sr-only">
                    Adjust the balance between keyword and semantic search from 0 to 1
                  </div>
                </div>
              )}
            </div>
          )}

          {!vectorStatus?.enabled && (
            <Text className="text-gray-500">
              Vector search is not configured. Add vectorSearch configuration to your plugin options to enable AI-powered semantic search.
            </Text>
          )}
        </div>

        {/* Data Synchronization */}
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Heading level="h2">Data Synchronization</Heading>
          </div>
          <Text className="text-gray-500 mb-4">
            Manually trigger synchronization of your product catalog with Meilisearch. 
            {vectorStatus?.enabled && ' This will also generate embeddings for semantic search.'}
          </Text>
          <Button onClick={handleSync} isLoading={syncPending} variant="primary">
            Sync Now
          </Button>
        </div>

        {/* Search Testing */}
        <div className="border border-gray-200 rounded-lg p-6">
          <div className="flex items-center gap-3 mb-4">
            <Heading level="h2">Search Testing</Heading>
          </div>
          <Text className="text-gray-500 mb-4">
            Test your search configuration with a custom query. 
            {vectorStatus?.enabled && ' You can test both traditional keyword search and AI-powered semantic search.'}
          </Text>
          
          <div className="space-y-4">
            <div>
              <Text className="text-sm font-medium text-gray-700 mb-2">Search Query</Text>
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter search query (e.g., 'blue shirt', 'comfortable clothing')"
                className="w-full"
                aria-label="Search query input"
                aria-describedby="search-query-help"
              />
              <div id="search-query-help" className="sr-only">
                Enter a search term to test the search functionality
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button 
                onClick={handleTestSearch} 
                isLoading={testPending} 
                variant="secondary"
                disabled={!searchQuery.trim()}
              >
                Test Search
              </Button>
              
              {vectorStatus?.enabled && (
                <Text className="text-sm text-gray-500 self-center">
                  {semanticSearchEnabled 
                    ? `Using hybrid search (${Math.round(semanticRatio * 100)}% semantic)`
                    : 'Using keyword search only'
                  }
                </Text>
              )}
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: 'Meilisearch',
})

export default SyncPage
