import { beforeEach, describe, expect, it } from 'vitest'
import { useNotifications } from '../../src/shared/notifications/notificationStore'

// El almacén es un estado de módulo compartido: cada prueba parte de una región vacía.
const { notifications, notify, dismiss } = useNotifications()
beforeEach(() => { for (const item of [...notifications.value]) dismiss(item.notificationId) })

describe('notification store', () => {
  it('returns the id of a new or duplicated notice so its author can retire it', () => {
    const notificationId = notify('Sesión terminada', 'Vuelve a iniciar sesión para continuar.')
    expect(notify('Sesión terminada', 'Vuelve a iniciar sesión para continuar.')).toBe(notificationId)
    expect(notifications.value).toHaveLength(1)
    dismiss(notificationId)
    expect(notifications.value).toHaveLength(0)
  })

  it('keeps at most three transient notices and never drops errors', () => {
    notify('Error', 'No se pudo guardar', 'error')
    for (const folio of ['F-1', 'F-2', 'F-3', 'F-4']) notify('Movimiento registrado', folio, 'success')
    expect(notifications.value.map(item => item.message)).toEqual(['No se pudo guardar', 'F-2', 'F-3', 'F-4'])
  })
})
