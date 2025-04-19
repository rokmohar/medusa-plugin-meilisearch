export const transformProduct = (product: any) => {
  return { ...product } as Record<string, unknown>
}
