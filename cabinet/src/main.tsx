import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './locales/i18n'
import './styles/index.css'
import './styles/application.css'
import './styles/files.css'
import './styles/workspace.css'
import { router } from './app/router'
const client = new QueryClient({
  defaultOptions: { queries: { staleTime: 15000, refetchOnWindowFocus: false } },
})
async function bootstrap() {
  // This build is an explicitly disclosed frontend demo. Replace the API adapter
  // and remove MSW activation before integrating a real authenticated service.
  if (import.meta.env.DEV) {
    const { worker } = await import('./mocks/browser')
    await worker.start({ quiet: true, onUnhandledRequest: 'bypass' })
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>,
  )
}
bootstrap().catch(() => {
  const root = document.getElementById('root')!
  root.replaceChildren()
  const p = document.createElement('p')
  p.textContent =
    'Не удалось запустить локальное демо. Разреши Service Worker и обнови страницу. / Жергілікті демоны іске қосу мүмкін болмады. Service Worker рұқсатын тексеріп, бетті жаңарт.'
  root.append(p)
})
