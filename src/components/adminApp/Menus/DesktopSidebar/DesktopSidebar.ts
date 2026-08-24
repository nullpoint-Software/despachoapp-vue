interface MenuItem {
  name: string
  path: string
  icon: string
}

interface DesktopSidebarProps {
  menuItems: MenuItem[]
}

defineProps<DesktopSidebarProps>()
