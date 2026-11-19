import { afterEach, describe, expect, it } from 'vitest'
import { effectScope, nextTick } from 'vue'
import { consumeNavigationRequest, describeNavigationAction, describeNavigationTarget, discardNavigationRequest, navigationRequest, requestNavigation, useNavigationRequest, type NavigationRequest } from '../../src/shared/navigation/navigationRequests'
import { useNotifications } from '../../src/shared/notifications/notificationStore'

// Estado de módulo compartido: cada prueba deja la solicitud vacía.
afterEach(() => discardNavigationRequest())

describe('navigation requests', () => {
  it('keeps a single pending request; a newer one replaces the previous', () => {
    const first = requestNavigation({ section: 'tasks', itemId: 'task-1' })
    const second = requestNavigation({ section: 'payments', itemId: 'movement-1' })
    expect(second.requestId).toBeGreaterThan(first.requestId)
    expect(navigationRequest.value?.section).toBe('payments')
  })

  it('is consumed only by its own section', () => {
    requestNavigation({ section: 'clients', itemId: 'client-1' })
    expect(consumeNavigationRequest('tasks')).toBeNull()
    expect(consumeNavigationRequest('clients')?.itemId).toBe('client-1')
    expect(navigationRequest.value).toBeNull()
  })

  it('discards only the request it was told about', () => {
    const stale = requestNavigation({ section: 'fiscal' })
    const fresh = requestNavigation({ section: 'compliance' })
    discardNavigationRequest(stale.requestId)
    expect(navigationRequest.value?.requestId).toBe(fresh.requestId)
    discardNavigationRequest(fresh.requestId)
    expect(navigationRequest.value).toBeNull()
  })

  it('hands pending and later requests to the page of that section', async () => {
    const received: NavigationRequest[] = []
    requestNavigation({ section: 'tasks', itemId: 'already-pending' })
    const scope = effectScope()
    scope.run(() => useNavigationRequest('tasks', request => { received.push(request) }))
    expect(received.map(request => request.itemId)).toEqual(['already-pending'])
    requestNavigation({ section: 'clients', itemId: 'other-section' })
    await nextTick()
    expect(received).toHaveLength(1)
    requestNavigation({ section: 'tasks', itemId: 'later' })
    await nextTick()
    expect(received.map(request => request.itemId)).toEqual(['already-pending', 'later'])
    scope.stop()
  })

  it('describes the destination for the accessible name, contracting "a el"', () => {
    expect(describeNavigationTarget({ section: 'compliance' })).toBe('Cumplimiento')
    expect(describeNavigationAction({ section: 'tasks', label: 'la tarea T-000001' })).toBe('ir a la tarea T-000001')
    expect(describeNavigationAction({ section: 'fiscal', label: 'el reporte Mensual' })).toBe('ir al reporte Mensual')
  })

  it('stores a copy of the target on the notification', () => {
    const { notifications, notify, dismiss } = useNotifications()
    const target = { section: 'payments' as const, itemId: 'movement-9' }
    const notificationId = notify('Movimiento registrado', 'F-000009', 'success', { target })
    target.itemId = 'changed'
    expect(notifications.value.find(item => item.notificationId === notificationId)?.target).toEqual({ section: 'payments', itemId: 'movement-9' })
    dismiss(notificationId)
  })
})
