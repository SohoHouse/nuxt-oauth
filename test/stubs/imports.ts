// Stands in for Nuxt's `#imports`, which only exists inside a Nuxt build.
export const useRuntimeConfig = () => ({ oauth: {} })
export const useNitroApp = () => ({ hooks: { callHook: async () => {} } })
