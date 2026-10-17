import { Icon } from '@iconify/react'
import home from '@iconify-icons/solar/home-angle-linear'
import tasks from '@iconify-icons/solar/checklist-minimalistic-linear'
import projects from '@iconify-icons/solar/folder-with-files-linear'
import team from '@iconify-icons/solar/users-group-rounded-linear'
import experience from '@iconify-icons/solar/diploma-verified-linear'
import bell from '@iconify-icons/solar/bell-linear'
import search from '@iconify-icons/solar/magnifer-linear'
import menu from '@iconify-icons/solar/hamburger-menu-linear'
import settings from '@iconify-icons/solar/settings-linear'
import arrow from '@iconify-icons/solar/arrow-right-up-linear'
const icons = { home, tasks, projects, team, experience, bell, search, menu, settings, arrow }
export function ClubIcon({ name, size = 21 }: { name: keyof typeof icons; size?: number }) {
  return <Icon icon={icons[name]} width={size} height={size} aria-hidden="true" />
}
