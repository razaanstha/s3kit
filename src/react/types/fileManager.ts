import type { CSSProperties } from 'react'
import type { S3Entry } from '../../core/types'

export interface FileManagerProps {
  /** API endpoint URL, e.g., "/api/s3" */
  apiUrl: string
  /** Custom fetch function for auth headers */
  fetch?: typeof fetch
  /** Called when a file is selected */
  onFileSelect?: (file: S3Entry) => void
  /** Called when selection changes */
  onSelectionChange?: (entries: S3Entry[]) => void
  /** Called when confirming selection (picker mode) */
  onConfirm?: (entries: S3Entry[]) => void
  /** Called when navigating to a path */
  onNavigate?: (path: string) => void
  /** Custom className for the root element */
  className?: string
  /** Custom styles for the root element */
  style?: CSSProperties
  /** Theme mode: 'light', 'dark', or 'system' */
  theme?: 'light' | 'dark' | 'system'
  /** UI mode */
  mode?: 'viewer' | 'picker' | 'manager'
  /** Selection type */
  selection?: 'single' | 'multiple'
  /** Action gates */
  allowActions?: Partial<{
    upload: boolean
    createFolder: boolean
    delete: boolean
    rename: boolean
    move: boolean
    copy: boolean
    restore: boolean
  }>
  /** Picker confirm button label */
  confirmLabel?: string
  /** Hide Trash folder and trash view */
  hideTrash?: boolean
  /** Optional extension filter (e.g. ['jpg','png']) */
  filterExtensions?: string[]
  /** Optional mime type filter (e.g. ['image/jpeg','application/pdf']) */
  filterMimeTypes?: string[]
  /** Toolbar controls */
  toolbar?: Partial<{
    search: boolean
    viewSwitcher: boolean
    sort: boolean
    breadcrumbs: boolean
  }>
  /** Controlled view mode */
  viewMode?: 'list' | 'grid'
  /** Default view mode (uncontrolled) */
  defaultViewMode?: 'list' | 'grid'
  /** Called when view mode changes */
  onViewModeChange?: (mode: 'list' | 'grid') => void
  /** Label overrides */
  labels?: Partial<{
    upload: string
    newFolder: string
    delete: string
    deleteForever: string
    restore: string
    emptyTrash: string
    confirm: string
    searchPlaceholder: string
  }>
}
