import { Button, Container, Heading } from '@medusajs/ui'
import { useMutation } from '@tanstack/react-query'
import { toast } from '@medusajs/ui'
import { defineRouteConfig } from '@medusajs/admin-sdk'

const SyncPage = () => {
  const { mutate, isPending } = useMutation({
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

  const handleSync = () => {
    mutate()
  }

  return (
    <Container>
      <div className="flex flex-col gap-y-4">
        <Heading level="h1">Meilisearch Sync</Heading>
        <p className="text-gray-500">Manually trigger synchronization with Meilisearch.</p>
        <Button onClick={handleSync} isLoading={isPending} variant="primary">
          Sync Now
        </Button>
      </div>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: 'Meilisearch',
})

export default SyncPage
