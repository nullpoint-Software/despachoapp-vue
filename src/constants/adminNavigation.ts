import type { NavigationItem } from '@/types/navigation'

export const ADMIN_NAVIGATION_ITEMS: NavigationItem[] = [
  { name: 'Inicio', path: '/app/inicio', icon: 'pi pi-home' },
  { name: 'Tareas', path: '/app/tareas', icon: 'pi pi-th-large' },
  { name: 'Clientes', path: '/app/clientes', icon: 'pi pi-id-card' },
  { name: 'Pagos', path: '/app/pagos', icon: 'pi pi-wallet' },
  { name: 'Fiscal', path: '/app/fiscal', icon: 'pi pi-percentage' },
  { name: 'Códigos SAT', path: '/app/catalogos-sat', icon: 'pi pi-search' },
  { name: 'Cumplimiento', path: '/app/cumplimiento', icon: 'pi pi-verified' }
]
