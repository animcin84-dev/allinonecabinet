import { http, HttpResponse } from 'msw'
import { DomainError, type Action } from '../domain'
import { loadDemoState, mutateDemoState, resetMockState } from './store'
export { resetMockState }
function responseError(error: unknown) {
  return error instanceof DomainError
    ? HttpResponse.json({ code: error.code, message: error.code }, { status: error.status })
    : HttpResponse.json({ code: 'serverError', message: 'serverError' }, { status: 500 })
}
export const handlers = [
  http.get('/api/state', async ({ request }) => {
    try {
      return HttpResponse.json(
        await loadDemoState(
          request.headers.get('x-demo-actor') ?? 'u-member',
          request.headers.get('x-demo-scenario') ?? 'normal',
        ),
      )
    } catch (error) {
      return responseError(error)
    }
  }),
  http.post('/api/action', async ({ request }) => {
    try {
      return HttpResponse.json(
        await mutateDemoState(
          request.headers.get('x-demo-actor') ?? 'u-member',
          (await request.json()) as Action,
          request.headers.get('x-demo-scenario') ?? 'normal',
        ),
      )
    } catch (error) {
      return responseError(error)
    }
  }),
]
