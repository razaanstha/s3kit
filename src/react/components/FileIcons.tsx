import { Code, File, FileText, FilmStrip, Image, MusicNote } from '@phosphor-icons/react'
import { UiIcon } from './UiIcon'

export function getFileIcon(filename: string, size = 20) {
  const ext = filename.split('.').pop()?.toLowerCase()
  const weight = 'light' as const

  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
    return <UiIcon icon={Image} size={size} weight={weight} boxed />
  }
  if (['mp4', 'webm', 'mov'].includes(ext || '')) {
    return <UiIcon icon={FilmStrip} size={size} weight={weight} boxed />
  }
  if (['mp3', 'wav', 'ogg'].includes(ext || '')) {
    return <UiIcon icon={MusicNote} size={size} weight={weight} boxed />
  }
  if (['js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css'].includes(ext || '')) {
    return <UiIcon icon={Code} size={size} weight={weight} boxed />
  }
  if (['pdf', 'txt', 'md', 'doc', 'docx'].includes(ext || '')) {
    return <UiIcon icon={FileText} size={size} weight={weight} boxed />
  }

  return <UiIcon icon={File} size={size} weight={weight} boxed />
}
