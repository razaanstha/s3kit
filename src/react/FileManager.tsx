'use client'

import { useEffect, useMemo, useState, useCallback, useRef, CSSProperties } from 'react'
import { S3FileManagerClient } from '../client/client'
import type { S3Entry, S3SearchOptions } from '../core/types'
import {
  Folder,
  House,
  UploadSimple,
  FolderPlus,
  Trash,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  X,
  CaretRight,
  DotsThree,
  DownloadSimple,
  ArrowCounterClockwise,
  PencilSimple,
  Warning,
  MagnifyingGlass,
  CaretUp,
  CaretDown,
  List,
  SquaresFour,
  Copy,
  FileText,
} from '@phosphor-icons/react'
import { ContextMenu } from '@base-ui/react'
import { Menu } from '@base-ui/react'
import { Dialog } from '@base-ui/react'
import fileManagerStyles from './FileManager.module.css'
import type { FileManagerProps } from './types/fileManager'
import { Button } from './components/Button'
import { Modal } from './components/Modal'
import { UiIcon } from './components/UiIcon'
import { getFileIcon } from './components/FileIcons'
import { useTheme } from './theme/fileManagerTheme'
import { TRASH_PATH } from './utils/fileManagerConstants'
import { buildAllowedExtensions, isImageFileName } from './utils/fileManagerFilters'
import { formatBytes, formatDate } from './utils/fileManagerFormat'
import { buildUniqueName } from './utils/fileManagerNames'
import {
  getParentPath,
  getRelativePathFromFile,
  joinPath,
  normalizeRelativePath,
} from './utils/fileManagerPaths'

// ─────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────

export function FileManager({
  apiUrl,
  fetch: customFetch,
  onFileSelect,
  onSelectionChange,
  onConfirm,
  onNavigate,
  className,
  style,
  theme: themeMode = 'light',
  mode = 'manager',
  selection = 'multiple',
  allowActions,
  confirmLabel = 'Select',
  hideTrash = false,
  filterExtensions,
  filterMimeTypes,
  toolbar,
  viewMode: viewModeProp,
  defaultViewMode = 'grid',
  onViewModeChange,
  labels,
}: FileManagerProps) {
  const theme = useTheme(themeMode)
  const showSearch = toolbar?.search ?? true
  const showViewSwitcher = toolbar?.viewSwitcher ?? true
  const showSort = toolbar?.sort ?? true
  const showBreadcrumbs = toolbar?.breadcrumbs ?? true
  const labelText = {
    upload: 'Upload',
    newFolder: 'New Folder',
    delete: 'Delete',
    deleteForever: 'Delete Forever',
    restore: 'Restore',
    emptyTrash: 'Empty Trash',
    confirm: confirmLabel,
    searchPlaceholder: 'Search files and folders...',
    ...labels,
  }
  const allowedExtensions = useMemo(
    () => buildAllowedExtensions(filterExtensions, filterMimeTypes),
    [filterExtensions, filterMimeTypes],
  )

  const can = {
    upload: mode === 'manager',
    createFolder: mode === 'manager',
    delete: mode === 'manager',
    rename: mode === 'manager',
    move: mode === 'manager',
    copy: mode === 'manager',
    restore: mode === 'manager',
    ...allowActions,
  }
  const [isMobile, setIsMobile] = useState(false)
  const portalContainer = typeof document === 'undefined' ? undefined : document.body

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(max-width: 720px)')
    const update = () => setIsMobile(mediaQuery.matches)
    update()
    mediaQuery.addEventListener('change', update)
    return () => mediaQuery.removeEventListener('change', update)
  }, [])

  const client = useMemo(() => {
    return new S3FileManagerClient({
      apiUrl,
      ...(customFetch ? { fetch: customFetch } : {}),
    })
  }, [apiUrl, customFetch])

  // State
  const [view, setView] = useState<'files' | 'trash'>('files')
  const [path, setPath] = useState('')
  const [entries, setEntries] = useState<S3Entry[]>([])
  const [searchResults, setSearchResults] = useState<S3Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [lastSelected, setLastSelected] = useState<S3Entry | null>(null)
  const [hoverRow, setHoverRow] = useState<string | null>(null)
  const [previewData, setPreviewData] = useState<{
    url: string
    entry: S3Entry
  } | null>(null)
  const [previewDisplay, setPreviewDisplay] = useState<{
    url: string
    entry: S3Entry
  } | null>(null)
  const [isPreviewClosing, setIsPreviewClosing] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const [isResizing, setIsResizing] = useState(false)
  const [inlinePreviews, setInlinePreviews] = useState<Record<string, string>>({})
  const [isSelectionMode, setIsSelectionMode] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size' | 'type'>('name')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
  const [internalViewMode, setInternalViewMode] = useState<'list' | 'grid'>(defaultViewMode)

  const viewMode = viewModeProp ?? internalViewMode
  const setViewMode = (next: 'list' | 'grid') => {
    if (!viewModeProp) setInternalViewMode(next)
    onViewModeChange?.(next)
  }

  const toolbarControlHeight = 34
  const headerLabelStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    fontWeight: 600,
    color: theme.textSecondary,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    padding: 0,
  }

  // Pagination state
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined)
  const [searchCursor, setSearchCursor] = useState<string | undefined>(undefined)
  const [hasMore, setHasMore] = useState(false)
  const [searchHasMore, setSearchHasMore] = useState(false)

  // Drag and drop state
  const [isDragOver, setIsDragOver] = useState(false)
  const [_dragCounter, setDragCounter] = useState(0)

  // Modals & Menu
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [emptyTrashOpen, setEmptyTrashOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [renameName, setRenameName] = useState('')
  const [renameTarget, setRenameTarget] = useState<S3Entry | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false)

  // Upload
  const [uploadItems, setUploadItems] = useState<
    Array<{
      file?: File
      path: string
      name: string
      loaded: number
      total: number
      status: 'uploading' | 'done' | 'error'
      error?: string | undefined
    }>
  >([])
  const [uploadCardOpen, setUploadCardOpen] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const previewPortalRef = useRef<HTMLDivElement>(null)
  const previewPortalContainer = previewPortalRef.current ?? rootRef.current ?? portalContainer
  const downloadUrlCacheRef = useRef<Map<string, string>>(new Map())
  const selectionAnchorRef = useRef<string | null>(null)
  const longPressTimerRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)
  const dragSelectionBaseRef = useRef<Set<string>>(new Set())
  const lastSelectionSigRef = useRef<string>('')
  const [dragSelect, setDragSelect] = useState<{
    active: boolean
    startX: number
    startY: number
    x: number
    y: number
    additive: boolean
  } | null>(null)

  // Keyboard handler for paste + escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()

        if (createFolderOpen) {
          setCreateFolderOpen(false)
          setNewFolderName('')
          return
        }
        if (renameOpen) {
          setRenameOpen(false)
          setRenameTarget(null)
          return
        }
        if (deleteOpen) {
          setDeleteOpen(false)
          return
        }
        if (emptyTrashOpen) {
          setEmptyTrashOpen(false)
          return
        }

        if (isDragOver) {
          setIsDragOver(false)
          setDragCounter(0)
          return
        }

        if (dragSelect) {
          setDragSelect(null)
          return
        }

        if (selected.size > 0) {
          setSelected(new Set())
          setLastSelected(null)
          setPreviewData(null)
          return
        }

        if (searchQuery.trim()) {
          setSearchQuery('')
          return
        }

        if (uploadCardOpen) {
          const hasActiveUploads = uploadItems.some((item) => item.status === 'uploading')
          if (!hasActiveUploads) {
            setUploadCardOpen(false)
          }
        }

        return
      }

      // Handle Ctrl+V / Cmd+V for paste
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && view === 'files') {
        // We can't directly access clipboard files in most browsers
        // But we can show a hint to the user
        console.log('Paste detected - use drag and drop or upload button for files')
      }
    },
    [
      view,
      createFolderOpen,
      renameOpen,
      deleteOpen,
      emptyTrashOpen,
      isDragOver,
      dragSelect,
      selected,
      searchQuery,
      uploadCardOpen,
      uploadItems,
    ],
  )

  // ─────────────────────────────────────────────────────────
  // Drag and Drop Handlers
  // ─────────────────────────────────────────────────────────

  const handleDragEnter = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (!can.upload || view !== 'files') return

      // Only handle file drops, not other drag operations
      if (e.dataTransfer.types.includes('Files')) {
        setDragCounter((prev) => prev + 1)
        setIsDragOver(true)
      }
    },
    [can.upload, view],
  )

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (!can.upload || view !== 'files') return

      setDragCounter((prev) => {
        const newCounter = prev - 1
        if (newCounter <= 0) {
          setIsDragOver(false)
          return 0
        }
        return newCounter
      })
    },
    [can.upload, view],
  )

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      if (e.dataTransfer.types.includes('Files')) {
        e.dataTransfer.dropEffect = can.upload && view === 'files' ? 'copy' : 'none'
      }
    },
    [can.upload, view],
  )

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()

      setIsDragOver(false)
      setDragCounter(0)

      if (!can.upload || view !== 'files') return

      const items = e.dataTransfer.items
      if (items && items.length > 0) {
        const dropped = await getDroppedItems(items)
        if (dropped.length > 0) {
          await onUpload(dropped)
          return
        }
      }

      const files = e.dataTransfer.files
      if (files && files.length > 0) {
        await onUpload(files)
      }
    },
    [can.upload, view],
  )

  // ─────────────────────────────────────────────────────────
  // Data Fetching
  // ─────────────────────────────────────────────────────────

  const refresh = useCallback(
    async (loadMore = false) => {
      if (!loadMore) {
        setLoading(true)
        setSelected(new Set())
        setLastSelected(null)
        setPreviewData(null)
      } else {
        setLoadingMore(true)
      }

      try {
        const fetchPath = view === 'trash' ? (path ? joinPath(TRASH_PATH, path) : TRASH_PATH) : path
        const out = await client.list({
          path: fetchPath,
          limit: 100,
          ...(loadMore && nextCursor ? { cursor: nextCursor } : {}),
        })

        let items = out.entries

        if (allowedExtensions) {
          items = items.filter((entry) => {
            if (entry.type === 'folder') return true
            const ext = entry.name.split('.').pop()?.toLowerCase()
            return ext ? allowedExtensions.has(ext) : false
          })
        }

        if (hideTrash) {
          items = items.filter((entry) => entry.path !== `${TRASH_PATH}/`)
        }

        if (loadMore) {
          setEntries((prev) => [...prev, ...items])
        } else {
          setEntries(items)
        }

        setNextCursor(out.nextCursor)
        setHasMore(!!out.nextCursor)
      } catch (e) {
        console.error(e)
        if (!loadMore) {
          setEntries([])
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [client, path, view, nextCursor, allowedExtensions, hideTrash],
  )

  const performSearch = useCallback(
    async (query: string, loadMore = false) => {
      if (!query.trim()) {
        setSearchResults([])
        setSearching(false)
        setSearchCursor(undefined)
        setSearchHasMore(false)
        return
      }

      if (!loadMore) {
        setSearching(true)
        setSelected(new Set())
        setLastSelected(null)
        setPreviewData(null)
      } else {
        setLoadingMore(true)
      }

      try {
        // Try server-side search first, fallback to client-side if not available
        try {
          const searchOptions: S3SearchOptions = {
            query: query.trim(),
            recursive: true,
            limit: 100,
            ...(loadMore && searchCursor ? { cursor: searchCursor } : {}),
          }

          if (view === 'trash') {
            searchOptions.path = TRASH_PATH
          }

          const out = await client.search(searchOptions)

          let items = out.entries
          // Filter out .trash folder from root in normal view when searching
          if (view === 'files') {
            items = items.filter((e) => {
              if (!e.path.startsWith(TRASH_PATH)) return true
              return e.path === `${TRASH_PATH}/`
            })
          }

          if (allowedExtensions) {
            items = items.filter((entry) => {
              if (entry.type === 'folder') return true
              const ext = entry.name.split('.').pop()?.toLowerCase()
              return ext ? allowedExtensions.has(ext) : false
            })
          }

          if (hideTrash) {
            items = items.filter((entry) => entry.path !== `${TRASH_PATH}/`)
          }

          if (loadMore) {
            setSearchResults((prev) => [...prev, ...items])
          } else {
            setSearchResults(items)
          }

          setSearchCursor(out.nextCursor)
          setSearchHasMore(!!out.nextCursor)
        } catch (serverError: any) {
          // If server search fails (404, etc.), fall back to client-side search
          if (
            serverError.message?.includes('404') ||
            serverError.message?.includes('Request failed: 404')
          ) {
            console.log('Server search not available, using client-side search')

            // Use current entries for client-side search
            const searchTerm = query.trim().toLowerCase()
            const filtered = entries.filter((entry) =>
              entry.name.toLowerCase().includes(searchTerm),
            )

            setSearchResults(filtered)
            setSearchHasMore(false)
          } else {
            throw serverError // Re-throw other errors
          }
        }
      } catch (e) {
        console.error('Search failed:', e)
        if (!loadMore) {
          setSearchResults([])
        }
      } finally {
        setSearching(false)
        setLoadingMore(false)
      }
    },
    [client, view, entries, searchCursor, allowedExtensions, hideTrash],
  )

  useEffect(() => {
    // Reset pagination when path or view changes
    setNextCursor(undefined)
    setHasMore(false)
    refresh()
  }, [client, path, view]) // Remove refresh from dependencies to avoid infinite loop

  useEffect(() => {
    if (hideTrash && view === 'trash') {
      setView('files')
      setPath('')
    }
  }, [hideTrash, view])

  // Debounced search effect
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery)
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery, view]) // Remove performSearch from dependencies

  useEffect(() => {
    onNavigate?.(path)
  }, [path, onNavigate])

  useEffect(() => {
    const source = searchQuery.trim() ? searchResults : entries
    const selectedEntries = source.filter((entry) => selected.has(entry.path))
    const sig = selectedEntries
      .map((entry) => entry.path)
      .sort()
      .join('|')
    if (sig === lastSelectionSigRef.current) return
    lastSelectionSigRef.current = sig
    onSelectionChange?.(selectedEntries)
  }, [entries, searchResults, selected, searchQuery, onSelectionChange])

  useEffect(() => {
    const source = searchQuery.trim() ? searchResults : entries
    const selectedFiles = source
      .filter((entry) => selected.has(entry.path))
      .filter((entry): entry is Extract<S3Entry, { type: 'file' }> => entry.type === 'file')

    const toPrepare = selectedFiles
      .slice(0, 25)
      .map((file) => file.path)
      .filter((p) => !downloadUrlCacheRef.current.has(p))

    if (toPrepare.length === 0) return

    let cancelled = false
    const run = async () => {
      await Promise.all(
        toPrepare.map(async (p) => {
          try {
            const out = await client.getPreviewUrl({ path: p, inline: false })
            if (cancelled) return
            downloadUrlCacheRef.current.set(p, out.url)
          } catch {
            // Ignore; user can retry
          }
        }),
      )
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [client, entries, searchResults, searchQuery, selected])

  // Fetch preview
  useEffect(() => {
    if (selected.size === 1 && lastSelected?.type === 'file' && selected.has(lastSelected.path)) {
      const fetchPreview = async () => {
        try {
          const out = await client.getPreviewUrl({
            path: lastSelected.path,
            inline: true,
          })
          setPreviewData({ url: out.url, entry: lastSelected })
        } catch (e) {
          console.error('Failed to load preview', e)
        }
      }
      fetchPreview()
    } else {
      setPreviewData(null)
    }
  }, [selected, lastSelected, client])

  useEffect(() => {
    if (previewData) {
      setPreviewDisplay(previewData)
      setIsPreviewClosing(false)
      return
    }

    if (!previewDisplay) return
    setIsPreviewClosing(true)
    const timeoutId = window.setTimeout(() => {
      setPreviewDisplay(null)
      setIsPreviewClosing(false)
    }, 200)

    return () => window.clearTimeout(timeoutId)
  }, [previewData, previewDisplay])

  useEffect(() => {
    const prevent = (e: DragEvent) => {
      e.preventDefault()
    }
    window.addEventListener('dragover', prevent)
    window.addEventListener('drop', prevent)
    return () => {
      window.removeEventListener('dragover', prevent)
      window.removeEventListener('drop', prevent)
    }
  }, [])

  useEffect(() => {
    if (selected.size === 0 && isSelectionMode) {
      setIsSelectionMode(false)
      selectionAnchorRef.current = null
    }
  }, [selected, isSelectionMode])

  useEffect(() => {
    if (view !== 'files') return
    if (!selected.has(`${TRASH_PATH}/`)) return
    setSelected((prev) => {
      const next = new Set(prev)
      next.delete(`${TRASH_PATH}/`)
      return next
    })
  }, [selected, view])

  useEffect(() => {
    if (!dragSelect?.active) return

    const handleMove = (e: MouseEvent) => {
      const container = listRef.current
      if (!container) return
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left + container.scrollLeft
      const y = e.clientY - rect.top + container.scrollTop
      setDragSelect((prev) => (prev ? { ...prev, x, y } : prev))

      const left = Math.min(dragSelect.startX, x)
      const top = Math.min(dragSelect.startY, y)
      const right = Math.max(dragSelect.startX, x)
      const bottom = Math.max(dragSelect.startY, y)

      const elements = Array.from(container.querySelectorAll<HTMLElement>('[data-entry-path]'))

      const selectedPaths = new Set<string>()
      for (const el of elements) {
        const pathAttr = el.getAttribute('data-entry-path')
        const selectable = el.getAttribute('data-entry-selectable')
        if (selectable === 'false') continue
        if (!pathAttr) continue
        const elRect = el.getBoundingClientRect()
        const elLeft = elRect.left - rect.left + container.scrollLeft
        const elTop = elRect.top - rect.top + container.scrollTop
        const elRight = elLeft + elRect.width
        const elBottom = elTop + elRect.height
        const intersects = elLeft < right && elRight > left && elTop < bottom && elBottom > top
        if (intersects) selectedPaths.add(pathAttr)
      }

      setSelected(() => {
        const base = dragSelect.additive ? new Set(dragSelectionBaseRef.current) : new Set<string>()
        for (const path of selectedPaths) base.add(path)
        return base
      })
      setLastSelected(null)
      setIsSelectionMode(true)
    }

    const handleUp = () => {
      setDragSelect(null)
    }

    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleUp)
    return () => {
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleUp)
    }
  }, [dragSelect])

  const updateSidebarWidth = useCallback((clientX: number) => {
    const availableWidth = rootRef.current?.getBoundingClientRect().width ?? window.innerWidth
    const maxWidth = Math.min(520, availableWidth * 0.6)
    const minWidth = Math.min(280, maxWidth)
    const next = window.innerWidth - clientX
    const clamped = Math.max(minWidth, Math.min(maxWidth, next))
    setSidebarWidth(clamped)
  }, [])

  useEffect(() => {
    if (!isResizing) return

    const onMouseMove = (e: MouseEvent) => {
      e.preventDefault()
      updateSidebarWidth(e.clientX)
    }

    const onTouchMove = (e: TouchEvent) => {
      if (!e.touches[0]) return
      e.preventDefault()
      updateSidebarWidth(e.touches[0].clientX)
    }

    const onStop = () => setIsResizing(false)

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onStop)
    document.addEventListener('mouseleave', onStop)
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('touchend', onStop)
    document.addEventListener('touchcancel', onStop)

    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onStop)
      document.removeEventListener('mouseleave', onStop)
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onStop)
      document.removeEventListener('touchcancel', onStop)
    }
  }, [isResizing, updateSidebarWidth])

  // ─────────────────────────────────────────────────────────
  // Actions
  // ─────────────────────────────────────────────────────────

  function handleNavigate(newPath: string) {
    setPath(newPath)
  }

  async function onCreateFolder() {
    if (!can.createFolder || view !== 'files') return
    if (!newFolderName.trim()) return
    const existingNames = new Set(entries.map((entry) => entry.name))
    const uniqueName = buildUniqueName(newFolderName.trim(), existingNames)
    await client.createFolder({ path: joinPath(path, uniqueName) })
    setNewFolderName('')
    setCreateFolderOpen(false)
    refresh()
  }

  async function onRename() {
    if (!can.rename || view !== 'files') return
    if (!renameName.trim()) return
    if (isRenaming) return
    const target = renameTarget ?? lastSelected
    if (!target) return
    const oldPath = target.path
    const parent = getParentPath(oldPath)
    const existingNames = new Set(
      entries.filter((entry) => entry.path !== oldPath).map((entry) => entry.name),
    )
    const uniqueName = buildUniqueName(renameName.trim(), existingNames)
    const nextPath = parent ? joinPath(parent, uniqueName) : uniqueName
    const newPath = target.type === 'folder' ? `${nextPath.replace(/\/+$/, '')}/` : nextPath
    if (newPath === oldPath) {
      setRenameOpen(false)
      setRenameTarget(null)
      return
    }

    try {
      setIsRenaming(true)
      await client.move({ fromPath: oldPath, toPath: newPath })
      setRenameOpen(false)
      setRenameTarget(null)
      refresh()
    } catch (e) {
      console.error('Rename failed', e)
      alert('Rename failed')
    } finally {
      setIsRenaming(false)
    }
  }

  async function deleteEntries(targets: S3Entry[]) {
    if (!can.delete) return
    if (view === 'files') {
      for (const target of targets) {
        if (target.path.startsWith(TRASH_PATH)) continue
        const dest = joinPath(TRASH_PATH, target.path)
        await client.move({ fromPath: target.path, toPath: dest })
      }
    } else {
      const files = targets.filter((e) => e.type === 'file').map((e) => e.path)
      const folders = targets.filter((e) => e.type === 'folder')

      if (files.length > 0) await client.deleteFiles({ paths: files })
      for (const folder of folders) {
        await client.deleteFolder({ path: folder.path, recursive: true })
      }
    }
  }

  async function onDelete() {
    if (!can.delete) return
    if (isDeleting) return
    const source = searchQuery.trim() ? searchResults : entries
    const targets = source.filter((e) => selected.has(e.path))
    try {
      setIsDeleting(true)
      await deleteEntries(targets)
      setDeleteOpen(false)
      refresh()
    } catch (e) {
      console.error('Delete failed', e)
      alert('Delete failed')
    } finally {
      setIsDeleting(false)
    }
  }

  async function restoreEntries(targets: S3Entry[]) {
    if (!can.restore) return
    for (const target of targets) {
      if (!target.path.startsWith(TRASH_PATH)) continue
      const originalPath = target.path.slice(TRASH_PATH.length + 1)
      if (!originalPath) continue
      await client.move({ fromPath: target.path, toPath: originalPath })
    }
  }

  async function onRestore() {
    if (!can.restore) return
    const source = searchQuery.trim() ? searchResults : entries
    const targets = source.filter((e) => selected.has(e.path))
    await restoreEntries(targets)
    refresh()
  }

  async function onEmptyTrash() {
    if (!can.restore) return
    if (isEmptyingTrash) return
    try {
      setIsEmptyingTrash(true)
      await client.deleteFolder({ path: TRASH_PATH, recursive: true })
      setEmptyTrashOpen(false)
      refresh()
    } catch (e) {
      console.error('Empty trash failed', e)
      alert('Empty trash failed')
    } finally {
      setIsEmptyingTrash(false)
    }
  }

  async function onUpload(files: FileList | Array<{ file: File; path: string }> | null) {
    if (!can.upload || view !== 'files') return
    if (!files || files.length === 0) return
    const baseItems = Array.isArray(files)
      ? files
      : Array.from(files).map((file) => {
          const rel = getRelativePathFromFile(file)
          return {
            file,
            path: joinPath(path, rel ?? file.name),
          }
        })

    const existingByFolder = new Map<string, Set<string>>()
    const currentFolderNames = new Set(entries.map((entry) => entry.name))
    existingByFolder.set(path, currentFolderNames)

    const items = baseItems.map((item) => {
      const parent = getParentPath(item.path)
      const name = item.path.split('/').pop() ?? item.path
      const existing = existingByFolder.get(parent) ?? new Set<string>()
      const uniqueName = buildUniqueName(name, existing)
      existing.add(uniqueName)
      existingByFolder.set(parent, existing)
      const uniquePath = parent ? joinPath(parent, uniqueName) : uniqueName
      return { ...item, path: uniquePath }
    })
    const initialUploadItems = items.map((item) => ({
      file: item.file,
      path: item.path,
      name: item.path.split('/').pop() ?? item.path,
      loaded: 0,
      total: item.file.size ?? 0,
      status: 'uploading' as const,
      error: undefined,
    }))
    setUploadCardOpen(true)
    setUploadItems(initialUploadItems)
    await client.uploadFiles({
      files: items,
      parallel: 4,
      hooks: {
        onUploadProgress: ({ path: p, loaded, total }) => {
          if (!total) return
          setUploadItems((prev) =>
            prev.map((item) =>
              item.path === p
                ? {
                    ...item,
                    loaded,
                    total: total ?? item.total,
                    status: 'uploading',
                    error: undefined,
                  }
                : item,
            ),
          )
        },
        onUploadComplete: ({ path: p }) =>
          setUploadItems((prev) =>
            prev.map((item) =>
              item.path === p
                ? {
                    ...item,
                    loaded: item.total,
                    status: 'done',
                    error: undefined,
                  }
                : item,
            ),
          ),
        onUploadError: ({ path: p, error }) =>
          setUploadItems((prev) =>
            prev.map((item) => {
              if (item.path !== p) return item
              const message =
                error instanceof Error ? error.message : error ? String(error) : 'Upload failed'
              return { ...item, status: 'error', error: message }
            }),
          ),
      },
    })
    refresh()
  }

  async function retryUpload(item: { file?: File; path: string }) {
    if (!can.upload || view !== 'files') return
    if (!item.file) {
      window.alert('Original file not available. Please re-upload.')
      return
    }
    const file = item.file
    setUploadCardOpen(true)
    setUploadItems((prev) =>
      prev.map((entry) =>
        entry.path === item.path
          ? {
              ...entry,
              loaded: 0,
              total: file.size ?? entry.total,
              status: 'uploading',
              error: undefined,
            }
          : entry,
      ),
    )
    await client.uploadFiles({
      files: [{ file, path: item.path }],
      parallel: 1,
      hooks: {
        onUploadProgress: ({ path: p, loaded, total }) => {
          if (!total) return
          setUploadItems((prev) =>
            prev.map((entry) =>
              entry.path === p
                ? {
                    ...entry,
                    loaded,
                    total: total ?? entry.total,
                    status: 'uploading',
                    error: undefined,
                  }
                : entry,
            ),
          )
        },
        onUploadComplete: ({ path: p }) =>
          setUploadItems((prev) =>
            prev.map((entry) =>
              entry.path === p
                ? {
                    ...entry,
                    loaded: entry.total,
                    status: 'done',
                    error: undefined,
                  }
                : entry,
            ),
          ),
        onUploadError: ({ path: p, error }) =>
          setUploadItems((prev) =>
            prev.map((entry) => {
              if (entry.path !== p) return entry
              const message =
                error instanceof Error ? error.message : error ? String(error) : 'Upload failed'
              return { ...entry, status: 'error', error: message }
            }),
          ),
      },
    })
    refresh()
  }

  function openEntry(entry: S3Entry) {
    if (entry.type === 'folder') {
      let nextPath = entry.path
      if (view === 'trash') {
        nextPath = entry.path.slice(TRASH_PATH.length + 1)
        setPath(nextPath)
        return
      }

      if (entry.path.startsWith(TRASH_PATH)) {
        setView('trash')
        const relPath = entry.path.slice(TRASH_PATH.length + 1)
        setPath(relPath)
        return
      }

      setPath(nextPath)
      return
    }

    setSelected(new Set([entry.path]))
    selectionAnchorRef.current = entry.path
    setIsSelectionMode(true)
    setLastSelected(entry)
    onFileSelect?.(entry)
  }

  function selectRange(entries: S3Entry[], startPath: string, endPath: string): Set<string> {
    const startIndex = entries.findIndex((entry) => entry.path === startPath)
    const endIndex = entries.findIndex((entry) => entry.path === endPath)
    if (startIndex === -1 || endIndex === -1) {
      return new Set([endPath])
    }
    const [from, to] = startIndex < endIndex ? [startIndex, endIndex] : [endIndex, startIndex]
    const next = new Set<string>()
    for (let i = from; i <= to; i += 1) {
      next.add(entries[i]!.path)
    }
    return next
  }

  function handleEntryClickWithSelection(
    entry: S3Entry,
    index: number,
    entries: S3Entry[],
    e: React.MouseEvent,
  ) {
    const isTrashFolder =
      view === 'files' && entry.type === 'folder' && entry.path === `${TRASH_PATH}/`
    if (isTrashFolder) {
      openEntry(entry)
      return
    }

    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }

    if (e.shiftKey && selectionAnchorRef.current) {
      if (selection === 'single') {
        setSelected(new Set([entry.path]))
        setLastSelected(null)
        setIsSelectionMode(true)
        return
      }
      const next = selectRange(entries, selectionAnchorRef.current, entry.path)
      setSelected(next)
      setLastSelected(null)
      setIsSelectionMode(true)
      return
    }

    if (isSelectionMode || e.metaKey || e.ctrlKey) {
      setSelected((prev) => {
        const next = new Set(prev)
        if (next.has(entry.path)) {
          next.delete(entry.path)
        } else {
          if (selection === 'single') {
            next.clear()
          }
          next.add(entry.path)
        }
        setIsSelectionMode(next.size > 0)
        return next
      })
      selectionAnchorRef.current = entry.path
      setLastSelected(null)
      return
    }

    setSelected((prev) => {
      const next = new Set(prev)
      const alreadySelected = next.has(entry.path)
      if (selection === 'single') {
        next.clear()
        if (!alreadySelected) {
          next.add(entry.path)
        }
      } else if (alreadySelected) {
        next.delete(entry.path)
      } else {
        next.add(entry.path)
      }
      setIsSelectionMode(next.size > 0)
      return next
    })
    selectionAnchorRef.current = entry.path
    setLastSelected(null)
  }

  function handleLongPressSelect(entry: S3Entry) {
    if (view === 'files' && entry.type === 'folder' && entry.path === `${TRASH_PATH}/`) {
      return
    }
    setIsSelectionMode(true)
    selectionAnchorRef.current = entry.path
    setSelected((prev) => {
      const next = new Set(prev)
      if (selection === 'single') {
        next.clear()
      }
      next.add(entry.path)
      return next
    })
    setLastSelected(null)
    suppressClickRef.current = true
  }

  async function bulkDownload(entriesToDownload: S3Entry[]) {
    const files = entriesToDownload.filter((entry) => entry.type === 'file')
    if (files.length === 0) return

    const cachedUrls = files
      .map((f) => downloadUrlCacheRef.current.get(f.path))
      .filter((u): u is string => typeof u === 'string')

    if (cachedUrls.length !== files.length) {
      if (files.length === 1) {
        try {
          const out = await client.getPreviewUrl({
            path: files[0]!.path,
            inline: false,
          })
          downloadUrlCacheRef.current.set(files[0]!.path, out.url)
          const a = document.createElement('a')
          a.href = out.url
          a.target = '_blank'
          a.rel = 'noopener noreferrer'
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
        } catch (e) {
          console.error(e)
        }
        return
      }

      // Avoid async generation during the click gesture for multi-file downloads.
      // Preparation runs in the background on selection change; ask user to retry.
      window.alert('Preparing download links… please click Download again in a moment.')
      return
    }

    if (cachedUrls.length > 20) {
      const ok = window.confirm(
        `Download ${cachedUrls.length} files? Your browser may ask to allow multiple downloads.`,
      )
      if (!ok) return
    }

    for (const url of cachedUrls) {
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    }
  }

  async function bulkCopy(entriesToCopy: S3Entry[]) {
    if (!can.copy) return
    const dest = window.prompt('Copy to folder path', path || '')
    if (!dest) return
    const baseDest = dest.replace(/\/+$/, '')
    for (const entry of entriesToCopy) {
      if (entry.path.startsWith(TRASH_PATH)) continue
      const targetName = entry.name || entry.path.split('/').pop() || entry.path
      const toPath =
        entry.type === 'folder'
          ? `${joinPath(baseDest, targetName)}/`
          : joinPath(baseDest, targetName)
      await client.copy({ fromPath: entry.path, toPath })
    }
    refresh()
  }

  async function bulkMove(entriesToMove: S3Entry[]) {
    if (!can.move) return
    const dest = window.prompt('Move to folder path', path || '')
    if (!dest) return
    const baseDest = dest.replace(/\/+$/, '')
    for (const entry of entriesToMove) {
      if (entry.path.startsWith(TRASH_PATH)) continue
      const targetName = entry.name || entry.path.split('/').pop() || entry.path
      const toPath =
        entry.type === 'folder'
          ? `${joinPath(baseDest, targetName)}/`
          : joinPath(baseDest, targetName)
      await client.move({ fromPath: entry.path, toPath })
    }
    refresh()
  }

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  const breadcrumbs = useMemo(() => {
    const parts = path.split('/').filter(Boolean)
    const crumbs = [{ name: view === 'trash' ? 'Trash' : 'Home', path: '' }]
    let cur = ''
    for (const part of parts) {
      cur = cur ? `${cur}/${part}` : part
      crumbs.push({ name: part, path: cur })
    }
    return crumbs
  }, [path, view])

  // Infinite scroll handler
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const { scrollTop, scrollHeight, clientHeight } = e.currentTarget
      const isNearBottom = scrollHeight - scrollTop <= clientHeight + 100 // 100px threshold

      if (isNearBottom && !loadingMore && !loading && !searching) {
        const isSearching = searchQuery.trim()
        const hasMoreItems = isSearching ? searchHasMore : hasMore

        if (hasMoreItems) {
          if (isSearching) {
            performSearch(searchQuery, true)
          } else {
            refresh(true)
          }
        }
      }
    },
    [loadingMore, loading, searching, searchQuery, searchHasMore, hasMore, performSearch, refresh],
  )

  // Get current entries (search results or regular entries)
  const currentEntries = useMemo(() => {
    return searchQuery.trim() ? searchResults : entries
  }, [searchQuery, searchResults, entries])

  useEffect(() => {
    let cancelled = false
    const toFetch = currentEntries
      .filter((entry) => entry.type === 'file' && isImageFileName(entry.name))
      .filter((entry) => !inlinePreviews[entry.path])
      .slice(0, 50)

    if (toFetch.length === 0) return

    const run = async () => {
      for (const entry of toFetch) {
        try {
          const out = await client.getPreviewUrl({
            path: entry.path,
            inline: true,
          })
          if (cancelled) return
          setInlinePreviews((prev) =>
            prev[entry.path] ? prev : { ...prev, [entry.path]: out.url },
          )
        } catch {
          // Ignore preview failures; fall back to icons
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [currentEntries, inlinePreviews, client, allowedExtensions])

  const showSidebar = previewDisplay !== null
  const showSidebarOnLayout = !isMobile && mode !== 'picker'
  const isSidebarVisible = showSidebarOnLayout && showSidebar

  async function getDroppedItems(
    items: DataTransferItemList,
  ): Promise<Array<{ file: File; path: string }>> {
    const entries: any[] = []
    for (const item of Array.from(items)) {
      const entry = (item as any).webkitGetAsEntry?.()
      if (entry) entries.push(entry)
    }
    if (entries.length === 0) return []

    const results: Array<{ file: File; path: string }> = []

    const readEntries = (reader: any): Promise<any[]> =>
      new Promise((resolve) => {
        reader.readEntries((batch: any[]) => resolve(batch))
      })

    const traverse = async (entry: any, prefix: string) => {
      if (entry.isFile) {
        const file = await new Promise<File>((resolve) => entry.file(resolve))
        const rel = normalizeRelativePath(prefix ? `${prefix}/${file.name}` : file.name)
        results.push({ file, path: joinPath(path, rel) })
        return
      }

      if (entry.isDirectory) {
        const reader = entry.createReader()
        let batch = await readEntries(reader)
        while (batch.length > 0) {
          for (const child of batch) {
            await traverse(child, prefix ? `${prefix}/${entry.name}` : entry.name)
          }
          batch = await readEntries(reader)
        }
      }
    }

    for (const entry of entries) {
      await traverse(entry, '')
    }

    return results
  }

  return (
    <div
      style={{
        minHeight: isMobile ? 0 : 500,
        maxHeight: isMobile ? '100%' : '100vh',
        ...style,
        ...({
          '--s3kit-bg': theme.bg,
          '--s3kit-bg-secondary': theme.bgSecondary,
          '--s3kit-border': theme.border,
          '--s3kit-text': theme.text,
          '--s3kit-text-secondary': theme.textSecondary,
          '--s3kit-icon-bg': theme.bgSecondary,
          '--s3kit-icon-border': theme.border,
          '--s3kit-icon-radius': '8px',
        } as unknown as CSSProperties),
      }}
      className={`${fileManagerStyles.root}${className ? ` ${className}` : ''}`}
      ref={rootRef}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Main Content */}
      <div
        className={fileManagerStyles.main}
        style={{
          ...(isDragOver
            ? {
                backgroundColor: theme.bg === '#ffffff' ? '#fafafa' : '#1a1a1a',
              }
            : undefined),
        }}
      >
        {/* Header */}
        <div
          className={fileManagerStyles.header}
          style={{
            padding: isMobile ? '12px 16px' : '16px 24px',
            ...(isMobile ? { gap: 8 } : {}),
          }}
        >
          {/* Left side: Navigation tabs + Breadcrumbs */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              minWidth: 0,
            }}
          >
            {/* Navigation Tabs */}
            <div
              className={fileManagerStyles.navTabs}
              style={{ flexWrap: isMobile ? 'wrap' : 'nowrap' }}
            >
              <button
                type="button"
                className={fileManagerStyles.navTab}
                style={{
                  backgroundColor: view === 'files' ? theme.selected : 'transparent',
                  color: view === 'files' ? theme.text : theme.textSecondary,
                  ...(isMobile ? { flex: '1 1 auto', justifyContent: 'center' } : {}),
                }}
                onClick={() => {
                  setView('files')
                  setPath('')
                  setSelected(new Set())
                  setLastSelected(null)
                }}
              >
                <UiIcon icon={House} size={16} />
                Home
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              gap: 8,
              flexWrap: 'nowrap',
              flexShrink: 0,
            }}
          >
            {view === 'trash' && selected.size === 0 && !hideTrash && can.restore && (
              <Button variant="danger" onClick={() => setEmptyTrashOpen(true)} theme={theme}>
                {labelText.emptyTrash}
              </Button>
            )}

            {view === 'trash' && selected.size > 0 && !hideTrash && can.restore && (
              <Button onClick={onRestore} theme={theme}>
                <UiIcon icon={ArrowCounterClockwise} size={16} /> {labelText.restore}
              </Button>
            )}

            {selected.size > 0 ? (
              can.delete && (
                <Button variant="danger" onClick={() => setDeleteOpen(true)} theme={theme}>
                  <UiIcon icon={Trash} size={16} />{' '}
                  {view === 'trash' ? labelText.deleteForever : labelText.delete}
                </Button>
              )
            ) : view === 'files' ? (
              <>
                {can.createFolder && (
                  <Button onClick={() => setCreateFolderOpen(true)} theme={theme}>
                    <UiIcon icon={FolderPlus} size={16} /> {labelText.newFolder}
                  </Button>
                )}
                {can.upload && (
                  <Button
                    variant="primary"
                    onClick={() => fileInputRef.current?.click()}
                    theme={theme}
                  >
                    <UiIcon icon={UploadSimple} size={16} /> {labelText.upload}
                  </Button>
                )}
              </>
            ) : null}
            {mode === 'picker' && (
              <Button
                variant="primary"
                onClick={() => {
                  const source = searchQuery.trim() ? searchResults : entries
                  const selectedEntries = source.filter((entry) => selected.has(entry.path))
                  onConfirm?.(selectedEntries)
                }}
                disabled={selected.size === 0}
                theme={theme}
              >
                {labelText.confirm}
              </Button>
            )}
            <input
              type="file"
              multiple
              ref={fileInputRef}
              style={{ display: 'none' }}
              disabled={!can.upload || view !== 'files'}
              onChange={(e) => onUpload(e.target.files)}
            />
          </div>
        </div>

        {/* Breadcrumbs */}
        {showBreadcrumbs && (path || view === 'trash') && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              padding: isMobile ? '8px 16px' : '10px 24px',
              borderBottom: `1px solid ${theme.border}`,
              overflowX: isMobile ? 'auto' : 'visible',
              whiteSpace: isMobile ? 'nowrap' : 'normal',
            }}
          >
            {breadcrumbs.map((crumb, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {idx > 0 && <UiIcon icon={CaretRight} size={12} color={theme.textSecondary} />}
                <button
                  type="button"
                  onClick={() => handleNavigate(crumb.path)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: idx === breadcrumbs.length - 1 ? 600 : 400,
                    color: idx === breadcrumbs.length - 1 ? theme.text : theme.textSecondary,
                  }}
                >
                  {crumb.name}
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Search + View Controls */}
        {(showSearch || showSort || (mode !== 'viewer' && showViewSwitcher)) && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: showSearch ? 'flex-start' : 'flex-end',
              gap: isMobile ? 8 : 12,
              padding: isMobile ? '10px 16px' : '12px 24px',
              borderBottom: `1px solid ${theme.border}`,
              flexWrap: 'nowrap',
            }}
          >
            {showSearch && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flex: 1,
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flex: 1,
                    minWidth: 0,
                    height: toolbarControlHeight,
                    padding: '0 10px',
                    border: `1px solid ${theme.border}`,
                    backgroundColor: theme.bg,
                    color: theme.text,
                    boxSizing: 'border-box',
                  }}
                >
                  <UiIcon icon={MagnifyingGlass} size={16} color={theme.textSecondary} />
                  <input
                    type="text"
                    placeholder={labelText.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      height: '100%',
                      padding: 0,
                      fontSize: 13,
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: theme.text,
                      outline: 'none',
                    }}
                  />
                </div>
                {(searchQuery || searching) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('')
                      setSearchResults([])
                    }}
                    disabled={searching}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: searching ? 'default' : 'pointer',
                      width: toolbarControlHeight,
                      height: toolbarControlHeight,
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: theme.textSecondary,
                      opacity: searching ? 0.5 : 1,
                    }}
                  >
                    <UiIcon icon={X} size={14} />
                  </button>
                )}
              </div>
            )}

            {(showSort || (mode !== 'viewer' && showViewSwitcher)) && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                {mode !== 'viewer' && showViewSwitcher && (
                  <div
                    style={{
                      display: 'flex',
                      border: `1px solid ${theme.border}`,
                      flexShrink: 0,
                      height: toolbarControlHeight,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setViewMode('list')}
                      style={{
                        background: viewMode === 'list' ? theme.selected : 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: theme.text,
                        width: toolbarControlHeight,
                        height: toolbarControlHeight,
                      }}
                      title="List View"
                    >
                      <UiIcon icon={List} size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      style={{
                        background: viewMode === 'grid' ? theme.selected : 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: theme.text,
                        width: toolbarControlHeight,
                        height: toolbarControlHeight,
                      }}
                      title="Grid View"
                    >
                      <UiIcon icon={SquaresFour} size={16} />
                    </button>
                  </div>
                )}
                {showSort && viewMode === 'grid' && (
                  <button
                    type="button"
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    style={{
                      background: theme.bg,
                      border: `1px solid ${theme.border}`,
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: theme.text,
                      width: toolbarControlHeight,
                      height: toolbarControlHeight,
                    }}
                    title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
                  >
                    {sortOrder === 'asc' ? (
                      <UiIcon icon={ArrowUp} size={16} />
                    ) : (
                      <UiIcon icon={ArrowDown} size={16} />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Search Status */}
        {showSearch && searchQuery.trim() && (
          <div
            style={{
              padding: '8px 24px',
              backgroundColor: theme.bgSecondary,
              borderBottom: `1px solid ${theme.border}`,
              fontSize: 12,
              color: theme.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <UiIcon icon={MagnifyingGlass} size={14} />
              {searching
                ? `Searching for "${searchQuery}"...`
                : `Found ${currentEntries.length} result${
                    currentEntries.length !== 1 ? 's' : ''
                  } for "${searchQuery}"`}
            </div>
            {searchHasMore && (
              <div style={{ fontSize: 11, opacity: 0.7 }}>More results available</div>
            )}
          </div>
        )}

        {/* File List */}
        <div
          style={{
            flex: 1,
            overflow: 'auto',
            minHeight: 0, // This is important for flex children to shrink properly
            WebkitOverflowScrolling: 'touch',
            position: 'relative',
          }}
          ref={listRef}
          onScroll={handleScroll}
          onMouseDown={(e) => {
            if (isMobile) return
            if (e.button !== 0) return
            const target = e.target as HTMLElement
            if (target.closest('[data-entry-path]')) return
            const container = listRef.current
            if (!container) return
            e.preventDefault()
            const rect = container.getBoundingClientRect()
            const startX = e.clientX - rect.left + container.scrollLeft
            const startY = e.clientY - rect.top + container.scrollTop
            dragSelectionBaseRef.current = new Set(selected)
            setDragSelect({
              active: true,
              startX,
              startY,
              x: startX,
              y: startY,
              additive: e.metaKey || e.ctrlKey,
            })
          }}
        >
          {dragSelect?.active && (
            <div
              style={{
                position: 'absolute',
                left: Math.min(dragSelect.startX, dragSelect.x),
                top: Math.min(dragSelect.startY, dragSelect.y),
                width: Math.abs(dragSelect.x - dragSelect.startX),
                height: Math.abs(dragSelect.y - dragSelect.startY),
                border: `1px solid ${theme.accent}`,
                backgroundColor:
                  theme.bg === '#ffffff' ? 'rgba(0,0,0,0.04)' : 'rgba(255,255,255,0.08)',
                pointerEvents: 'none',
                zIndex: 3,
              }}
            />
          )}
          {viewMode === 'list' && (
            <div
              className={fileManagerStyles.tableHeader}
              style={{
                gridTemplateColumns: isMobile ? '1fr 48px' : '1fr 120px 100px 48px',
                padding: isMobile ? '10px 16px' : '10px 24px',
              }}
            >
              {showSort ? (
                <button
                  type="button"
                  onClick={() => {
                    if (sortBy === 'name') {
                      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                    } else {
                      setSortBy('name')
                      setSortOrder('asc')
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    fontSize: 12,
                    fontWeight: 600,
                    color: sortBy === 'name' ? theme.text : theme.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    padding: 0,
                  }}
                >
                  Name
                  {sortBy === 'name' &&
                    (sortOrder === 'asc' ? (
                      <UiIcon icon={CaretUp} size={12} />
                    ) : (
                      <UiIcon icon={CaretDown} size={12} />
                    ))}
                </button>
              ) : (
                <div style={headerLabelStyle}>Name</div>
              )}
              {!isMobile &&
                (showSort ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (sortBy === 'date') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                      } else {
                        setSortBy('date')
                        setSortOrder('desc') // Default to newest first for dates
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: sortBy === 'date' ? theme.text : theme.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: 0,
                    }}
                  >
                    Date
                    {sortBy === 'date' &&
                      (sortOrder === 'asc' ? (
                        <UiIcon icon={CaretUp} size={12} />
                      ) : (
                        <UiIcon icon={CaretDown} size={12} />
                      ))}
                  </button>
                ) : (
                  <div style={headerLabelStyle}>Date</div>
                ))}
              {!isMobile &&
                (showSort ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (sortBy === 'size') {
                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
                      } else {
                        setSortBy('size')
                        setSortOrder('desc') // Default to largest first for size
                      }
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      fontSize: 12,
                      fontWeight: 600,
                      color: sortBy === 'size' ? theme.text : theme.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      padding: 0,
                    }}
                  >
                    Size
                    {sortBy === 'size' &&
                      (sortOrder === 'asc' ? (
                        <UiIcon icon={CaretUp} size={12} />
                      ) : (
                        <UiIcon icon={CaretDown} size={12} />
                      ))}
                  </button>
                ) : (
                  <div style={headerLabelStyle}>Size</div>
                ))}
              <div />
            </div>
          )}

          {loading || searching ? (
            <div
              style={{
                padding: 40,
                textAlign: 'center',
                color: theme.textSecondary,
              }}
            >
              {searching ? 'Searching...' : 'Loading...'}
            </div>
          ) : viewMode === 'grid' ? (
            // Grid View
            <>
              {/*
		                Grid tile layout targets:
		                - consistent gap between icon + label
		                - consistent tile height so content can be visually centered
		                - consistent icon/thumb box size across file/folder items
		              */}
              {(() => {
                const gridTileGap = 10
                const gridTileMinHeight = isMobile ? 120 : 140
                const gridThumbSize = 64
                const gridIconSize = 48
                const gridThumbStyle: CSSProperties = {
                  width: gridThumbSize,
                  height: gridThumbSize,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }

                const renderGridThumb = (entry: S3Entry) => {
                  if (entry.type === 'folder') {
                    return (
                      <UiIcon
                        icon={entry.path === `${TRASH_PATH}/` ? Trash : Folder}
                        size={gridIconSize}
                        weight="fill"
                        color={theme.text}
                        boxed
                      />
                    )
                  }

                  const previewUrl = inlinePreviews[entry.path]
                  if (previewUrl && isImageFileName(entry.name)) {
                    return (
                      <img
                        src={previewUrl}
                        alt={entry.name}
                        loading="lazy"
                        decoding="async"
                        style={{
                          width: gridThumbSize,
                          height: gridThumbSize,
                          objectFit: 'cover',
                          borderRadius: 8,
                          border: `1px solid ${theme.border}`,
                        }}
                      />
                    )
                  }

                  return getFileIcon(entry.name, gridIconSize)
                }

                return (
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: isMobile
                        ? 'repeat(auto-fill, minmax(120px, 1fr))'
                        : 'repeat(auto-fill, minmax(140px, 1fr))',
                      gap: 16,
                      padding: isMobile ? 16 : 24,
                    }}
                  >
                    {(() => {
                      // Filter and sort entries
                      const processEntries = (entries: S3Entry[]) => {
                        // No additional filtering needed since search is handled server-side
                        let filtered = entries

                        // Sort entries
                        filtered = [...filtered].sort((a, b) => {
                          let comparison = 0
                          const aIsTrash =
                            view === 'files' && a.type === 'folder' && a.path === `${TRASH_PATH}/`
                          const bIsTrash =
                            view === 'files' && b.type === 'folder' && b.path === `${TRASH_PATH}/`
                          if (aIsTrash !== bIsTrash) return aIsTrash ? 1 : -1

                          // Always put folders first
                          if (a.type !== b.type) {
                            return a.type === 'folder' ? -1 : 1
                          }

                          switch (sortBy) {
                            case 'name':
                              comparison = a.name.localeCompare(b.name)
                              break
                            case 'date':
                              const aDate =
                                a.type === 'file' && a.lastModified
                                  ? new Date(a.lastModified).getTime()
                                  : 0
                              const bDate =
                                b.type === 'file' && b.lastModified
                                  ? new Date(b.lastModified).getTime()
                                  : 0
                              comparison = aDate - bDate
                              break
                            case 'size':
                              comparison =
                                (a.type === 'file' ? a.size || 0 : 0) -
                                (b.type === 'file' ? b.size || 0 : 0)
                              break
                            case 'type':
                              const aExt = a.name.split('.').pop()?.toLowerCase() || ''
                              const bExt = b.name.split('.').pop()?.toLowerCase() || ''
                              comparison = aExt.localeCompare(bExt)
                              break
                          }

                          return sortOrder === 'asc' ? comparison : -comparison
                        })

                        return filtered
                      }

                      const filteredEntries = processEntries(currentEntries)

                      const selectedEntries = filteredEntries.filter((item) =>
                        selected.has(item.path),
                      )

                      return filteredEntries.map((entry, index) => {
                        const isSelected = selected.has(entry.path)

                        const isTrashFolder =
                          view === 'files' &&
                          entry.type === 'folder' &&
                          entry.path === `${TRASH_PATH}/`
                        const entryLabel = isTrashFolder ? 'Trash' : entry.name
                        const isMultiSelected = selectedEntries.length > 1 && isSelected
                        const actionEntries = isMultiSelected ? selectedEntries : [entry]
                        const hasContextMenuItems =
                          (!isMultiSelected && can.rename) ||
                          actionEntries.some((item) => item.type === 'file') ||
                          (view === 'files' && can.copy) ||
                          (isMultiSelected && view === 'files' && can.move) ||
                          (isMultiSelected && view === 'trash' && can.restore) ||
                          can.delete

                        if (isTrashFolder) {
                          return (
                            <div
                              key={entry.path}
                              data-entry-path={entry.path}
                              data-entry-selectable="false"
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                gap: gridTileGap,
                                padding: 16,
                                minHeight: gridTileMinHeight,
                                backgroundColor: isSelected
                                  ? theme.selected
                                  : hoverRow === entry.path
                                    ? theme.hover
                                    : theme.bg,
                                border: `1px solid ${isSelected ? theme.accent : theme.border}`,
                                cursor: 'pointer',
                                outline: 'none',
                                transition: 'all 0.15s',
                                position: 'relative',
                              }}
                              onClick={(e) =>
                                handleEntryClickWithSelection(entry, index, filteredEntries, e)
                              }
                              onDoubleClick={() => openEntry(entry)}
                              onMouseEnter={() => setHoverRow(entry.path)}
                              onMouseLeave={() => setHoverRow(null)}
                              onTouchStart={() => {
                                if (!isMobile) return
                                if (longPressTimerRef.current)
                                  window.clearTimeout(longPressTimerRef.current)
                                longPressTimerRef.current = window.setTimeout(() => {
                                  handleLongPressSelect(entry)
                                }, 350)
                              }}
                              onTouchMove={() => {
                                if (longPressTimerRef.current) {
                                  window.clearTimeout(longPressTimerRef.current)
                                  longPressTimerRef.current = null
                                }
                              }}
                              onTouchEnd={() => {
                                if (longPressTimerRef.current) {
                                  window.clearTimeout(longPressTimerRef.current)
                                  longPressTimerRef.current = null
                                }
                              }}
                            >
                              <div style={gridThumbStyle}>{renderGridThumb(entry)}</div>
                              {/* Name */}
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  wordBreak: 'break-word',
                                  color: theme.text,
                                  width: '100%',
                                }}
                              >
                                {entryLabel}
                              </div>
                            </div>
                          )
                        }

                        if (!hasContextMenuItems) {
                          return (
                            <div
                              key={entry.path}
                              data-entry-path={entry.path}
                              data-entry-selectable={isTrashFolder ? 'false' : 'true'}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                gap: gridTileGap,
                                padding: 16,
                                minHeight: gridTileMinHeight,
                                backgroundColor: isSelected
                                  ? theme.selected
                                  : hoverRow === entry.path
                                    ? theme.hover
                                    : theme.bg,
                                border: `1px solid ${isSelected ? theme.accent : theme.border}`,
                                cursor: 'pointer',
                                outline: 'none',
                                transition: 'all 0.15s',
                                position: 'relative',
                              }}
                              onClick={(e) =>
                                handleEntryClickWithSelection(entry, index, filteredEntries, e)
                              }
                              onDoubleClick={() => openEntry(entry)}
                              onMouseEnter={() => setHoverRow(entry.path)}
                              onMouseLeave={() => setHoverRow(null)}
                              onTouchStart={() => {
                                if (!isMobile) return
                                if (longPressTimerRef.current)
                                  window.clearTimeout(longPressTimerRef.current)
                                longPressTimerRef.current = window.setTimeout(() => {
                                  handleLongPressSelect(entry)
                                }, 350)
                              }}
                              onTouchMove={() => {
                                if (longPressTimerRef.current) {
                                  window.clearTimeout(longPressTimerRef.current)
                                  longPressTimerRef.current = null
                                }
                              }}
                              onTouchEnd={() => {
                                if (longPressTimerRef.current) {
                                  window.clearTimeout(longPressTimerRef.current)
                                  longPressTimerRef.current = null
                                }
                              }}
                            >
                              <div style={gridThumbStyle}>{renderGridThumb(entry)}</div>
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  wordBreak: 'break-word',
                                  color: theme.text,
                                  width: '100%',
                                }}
                              >
                                {entryLabel}
                              </div>
                            </div>
                          )
                        }

                        return (
                          <ContextMenu.Root
                            key={entry.path}
                            onOpenChange={(open) => {
                              if (open) {
                                if (isTrashFolder) return
                                if (!selected.has(entry.path)) {
                                  setSelected(new Set([entry.path]))
                                  selectionAnchorRef.current = entry.path
                                  setLastSelected(null)
                                  setIsSelectionMode(true)
                                }
                              }
                            }}
                          >
                            <ContextMenu.Trigger
                              data-entry-path={entry.path}
                              data-entry-selectable={isTrashFolder ? 'false' : 'true'}
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                textAlign: 'center',
                                gap: gridTileGap,
                                padding: 16,
                                minHeight: gridTileMinHeight,
                                backgroundColor: isSelected
                                  ? theme.selected
                                  : hoverRow === entry.path
                                    ? theme.hover
                                    : theme.bg,
                                border: `1px solid ${isSelected ? theme.accent : theme.border}`,
                                cursor: 'pointer',
                                outline: 'none',
                                transition: 'all 0.15s',
                                position: 'relative',
                              }}
                              onClick={(e) =>
                                handleEntryClickWithSelection(entry, index, filteredEntries, e)
                              }
                              onDoubleClick={() => openEntry(entry)}
                              onContextMenu={(e) => {
                                if (isTrashFolder) {
                                  e.preventDefault()
                                  e.stopPropagation()
                                }
                              }}
                              onMouseEnter={() => setHoverRow(entry.path)}
                              onMouseLeave={() => setHoverRow(null)}
                              onTouchStart={() => {
                                if (!isMobile) return
                                if (longPressTimerRef.current)
                                  window.clearTimeout(longPressTimerRef.current)
                                longPressTimerRef.current = window.setTimeout(() => {
                                  handleLongPressSelect(entry)
                                }, 350)
                              }}
                              onTouchMove={() => {
                                if (longPressTimerRef.current) {
                                  window.clearTimeout(longPressTimerRef.current)
                                  longPressTimerRef.current = null
                                }
                              }}
                              onTouchEnd={() => {
                                if (longPressTimerRef.current) {
                                  window.clearTimeout(longPressTimerRef.current)
                                  longPressTimerRef.current = null
                                }
                              }}
                            >
                              <div style={gridThumbStyle}>{renderGridThumb(entry)}</div>

                              {/* Name */}
                              <div
                                style={{
                                  fontSize: 12,
                                  fontWeight: 500,
                                  wordBreak: 'break-word',
                                  color: theme.text,
                                  width: '100%',
                                }}
                              >
                                {entryLabel}
                              </div>
                            </ContextMenu.Trigger>

                            {/* Context Menu (same as list view) */}
                            <ContextMenu.Portal container={portalContainer}>
                              <ContextMenu.Positioner style={{ zIndex: 10000 }}>
                                <ContextMenu.Popup
                                  style={{
                                    zIndex: 10000,
                                    backgroundColor: theme.bg,
                                    border: `1px solid ${theme.border}`,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                    padding: 4,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    minWidth: 160,
                                    outline: 'none',
                                  }}
                                >
                                  {!isMultiSelected && can.rename && (
                                    <ContextMenu.Item
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '8px 12px',
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        fontSize: 13,
                                        textAlign: 'left',
                                        color: theme.text,
                                        outline: 'none',
                                      }}
                                      onClick={() => {
                                        setRenameName(entry.name || '')
                                        setRenameTarget(entry)
                                        setRenameOpen(true)
                                      }}
                                    >
                                      <UiIcon icon={PencilSimple} size={16} /> Rename
                                    </ContextMenu.Item>
                                  )}
                                  {actionEntries.some((item) => item.type === 'file') && (
                                    <ContextMenu.Item
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '8px 12px',
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        fontSize: 13,
                                        textAlign: 'left',
                                        color: theme.text,
                                        outline: 'none',
                                      }}
                                      onClick={() => bulkDownload(actionEntries)}
                                    >
                                      <UiIcon icon={DownloadSimple} size={16} /> Download
                                    </ContextMenu.Item>
                                  )}
                                  {isMultiSelected && view === 'files' && can.move && (
                                    <ContextMenu.Item
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '8px 12px',
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        fontSize: 13,
                                        textAlign: 'left',
                                        color: theme.text,
                                        outline: 'none',
                                      }}
                                      onClick={() => bulkMove(actionEntries)}
                                    >
                                      <UiIcon icon={ArrowRight} size={16} /> Move
                                    </ContextMenu.Item>
                                  )}
                                  {view === 'files' && can.copy && (
                                    <ContextMenu.Item
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '8px 12px',
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        fontSize: 13,
                                        textAlign: 'left',
                                        color: theme.text,
                                        outline: 'none',
                                      }}
                                      onClick={() => bulkCopy(actionEntries)}
                                    >
                                      <UiIcon icon={Copy} size={16} /> Copy
                                    </ContextMenu.Item>
                                  )}
                                  {isMultiSelected && view === 'trash' && can.restore && (
                                    <ContextMenu.Item
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '8px 12px',
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        fontSize: 13,
                                        textAlign: 'left',
                                        color: theme.text,
                                        outline: 'none',
                                      }}
                                      onClick={() => restoreEntries(actionEntries)}
                                    >
                                      <UiIcon icon={ArrowCounterClockwise} size={16} /> Restore
                                    </ContextMenu.Item>
                                  )}
                                  {can.delete && (
                                    <ContextMenu.Item
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        padding: '8px 12px',
                                        border: 'none',
                                        background: 'none',
                                        cursor: 'pointer',
                                        fontSize: 13,
                                        textAlign: 'left',
                                        color: theme.danger,
                                        outline: 'none',
                                      }}
                                      onClick={() => {
                                        setSelected(new Set(actionEntries.map((item) => item.path)))
                                        setLastSelected(null)
                                        setIsSelectionMode(true)
                                        setDeleteOpen(true)
                                      }}
                                    >
                                      <UiIcon icon={Trash} size={16} /> Delete
                                    </ContextMenu.Item>
                                  )}
                                </ContextMenu.Popup>
                              </ContextMenu.Positioner>
                            </ContextMenu.Portal>
                          </ContextMenu.Root>
                        )
                      })
                    })()}
                  </div>
                )
              })()}
            </>
          ) : (
            // List View
            (() => {
              // Filter and sort entries
              const processEntries = (entries: S3Entry[]) => {
                // No additional filtering needed since search is handled server-side
                let filtered = entries

                // Sort entries
                filtered = [...filtered].sort((a, b) => {
                  let comparison = 0
                  const aIsTrash =
                    view === 'files' && a.type === 'folder' && a.path === `${TRASH_PATH}/`
                  const bIsTrash =
                    view === 'files' && b.type === 'folder' && b.path === `${TRASH_PATH}/`
                  if (aIsTrash !== bIsTrash) return aIsTrash ? 1 : -1

                  // Always put folders first
                  if (a.type !== b.type) {
                    return a.type === 'folder' ? -1 : 1
                  }

                  switch (sortBy) {
                    case 'name':
                      comparison = a.name.localeCompare(b.name)
                      break
                    case 'date':
                      const aDate =
                        a.type === 'file' && a.lastModified ? new Date(a.lastModified).getTime() : 0
                      const bDate =
                        b.type === 'file' && b.lastModified ? new Date(b.lastModified).getTime() : 0
                      comparison = aDate - bDate
                      break
                    case 'size':
                      comparison =
                        (a.type === 'file' ? a.size || 0 : 0) -
                        (b.type === 'file' ? b.size || 0 : 0)
                      break
                    case 'type':
                      const aExt = a.name.split('.').pop()?.toLowerCase() || ''
                      const bExt = b.name.split('.').pop()?.toLowerCase() || ''
                      comparison = aExt.localeCompare(bExt)
                      break
                  }

                  return sortOrder === 'asc' ? comparison : -comparison
                })

                return filtered
              }

              const filteredEntries = processEntries(currentEntries)
              const selectedEntries = filteredEntries.filter((item) => selected.has(item.path))

              return filteredEntries.map((entry, index) => {
                const isSelected = selected.has(entry.path)
                const isHovered = hoverRow === entry.path
                const isTrashFolder =
                  view === 'files' && entry.type === 'folder' && entry.path === `${TRASH_PATH}/`
                const entryLabel = isTrashFolder ? 'Trash' : entry.name
                const isMultiSelected = selectedEntries.length > 1 && isSelected
                const actionEntries = isMultiSelected ? selectedEntries : [entry]
                const hasContextMenuItems =
                  (!isMultiSelected && can.rename) ||
                  actionEntries.some((item) => item.type === 'file') ||
                  (view === 'files' && can.copy) ||
                  (isMultiSelected && view === 'files' && can.move) ||
                  (isMultiSelected && view === 'trash' && can.restore) ||
                  can.delete

                if (isTrashFolder) {
                  return (
                    <div
                      key={entry.path}
                      data-entry-path={entry.path}
                      data-entry-selectable="false"
                      className={fileManagerStyles.row}
                      style={{
                        gridTemplateColumns: isMobile ? '1fr 48px' : '1fr 120px 100px 48px',
                        padding: isMobile ? '12px 16px' : '12px 24px',
                        backgroundColor: isSelected
                          ? theme.selected
                          : isHovered
                            ? theme.hover
                            : theme.bg,
                        outline: 'none',
                      }}
                      onClick={(e) => {
                        if (e.button !== 0) return
                        handleEntryClickWithSelection(entry, index, filteredEntries, e)
                      }}
                      onDoubleClick={() => openEntry(entry)}
                      onMouseEnter={() => setHoverRow(entry.path)}
                      onMouseLeave={() => setHoverRow(null)}
                      onTouchStart={() => {
                        if (!isMobile) return
                        if (longPressTimerRef.current)
                          window.clearTimeout(longPressTimerRef.current)
                        longPressTimerRef.current = window.setTimeout(() => {
                          handleLongPressSelect(entry)
                        }, 350)
                      }}
                      onTouchMove={() => {
                        if (longPressTimerRef.current) {
                          window.clearTimeout(longPressTimerRef.current)
                          longPressTimerRef.current = null
                        }
                      }}
                      onTouchEnd={() => {
                        if (longPressTimerRef.current) {
                          window.clearTimeout(longPressTimerRef.current)
                          longPressTimerRef.current = null
                        }
                      }}
                    >
                      {/* Name */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: isMobile ? 'flex-start' : 'center',
                          gap: 12,
                          fontWeight: 500,
                          flexDirection: isMobile ? 'column' : 'row',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          <UiIcon icon={Trash} size={20} weight="fill" color={theme.text} boxed />
                          {entryLabel}
                        </div>
                        {isMobile && (
                          <div
                            style={{
                              fontSize: 11,
                              color: theme.textSecondary,
                              fontWeight: 400,
                            }}
                          >
                            Folder
                          </div>
                        )}
                      </div>

                      {/* Date */}
                      {!isMobile && <div style={{ color: theme.textSecondary }}>--</div>}

                      {/* Size */}
                      {!isMobile && (
                        <div
                          style={{
                            color: theme.textSecondary,
                            fontFamily: 'monospace',
                          }}
                        >
                          --
                        </div>
                      )}

                      <div />
                    </div>
                  )
                }

                if (!hasContextMenuItems) {
                  return (
                    <div
                      key={entry.path}
                      data-entry-path={entry.path}
                      data-entry-selectable={isTrashFolder ? 'false' : 'true'}
                      className={fileManagerStyles.row}
                      style={{
                        gridTemplateColumns: isMobile ? '1fr 48px' : '1fr 120px 100px 48px',
                        padding: isMobile ? '12px 16px' : '12px 24px',
                        backgroundColor: isSelected
                          ? theme.selected
                          : isHovered
                            ? theme.hover
                            : theme.bg,
                        outline: 'none',
                      }}
                      onClick={(e) => {
                        if (e.button !== 0) return
                        handleEntryClickWithSelection(entry, index, filteredEntries, e)
                      }}
                      onDoubleClick={() => openEntry(entry)}
                      onMouseEnter={() => setHoverRow(entry.path)}
                      onMouseLeave={() => setHoverRow(null)}
                      onTouchStart={() => {
                        if (!isMobile) return
                        if (longPressTimerRef.current)
                          window.clearTimeout(longPressTimerRef.current)
                        longPressTimerRef.current = window.setTimeout(() => {
                          handleLongPressSelect(entry)
                        }, 350)
                      }}
                      onTouchMove={() => {
                        if (longPressTimerRef.current) {
                          window.clearTimeout(longPressTimerRef.current)
                          longPressTimerRef.current = null
                        }
                      }}
                      onTouchEnd={() => {
                        if (longPressTimerRef.current) {
                          window.clearTimeout(longPressTimerRef.current)
                          longPressTimerRef.current = null
                        }
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: isMobile ? 'flex-start' : 'center',
                          gap: 12,
                          fontWeight: 500,
                          flexDirection: isMobile ? 'column' : 'row',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          {entry.type === 'folder' ? (
                            isTrashFolder ? (
                              <UiIcon
                                icon={Trash}
                                size={20}
                                weight="fill"
                                color={theme.text}
                                boxed
                              />
                            ) : (
                              <UiIcon
                                icon={Folder}
                                size={20}
                                weight="fill"
                                color={theme.text}
                                boxed
                              />
                            )
                          ) : (
                            (() => {
                              const previewUrl = inlinePreviews[entry.path]
                              if (previewUrl && isImageFileName(entry.name)) {
                                return (
                                  <img
                                    src={previewUrl}
                                    alt={entry.name}
                                    loading="lazy"
                                    decoding="async"
                                    style={{
                                      width: 20,
                                      height: 20,
                                      objectFit: 'cover',
                                      borderRadius: 4,
                                      border: `1px solid ${theme.border}`,
                                    }}
                                  />
                                )
                              }
                              return getFileIcon(entry.name)
                            })()
                          )}
                          {entryLabel}
                        </div>
                        {isMobile && (
                          <div
                            style={{
                              fontSize: 11,
                              color: theme.textSecondary,
                              fontWeight: 400,
                            }}
                          >
                            {entry.type === 'file'
                              ? `${
                                  entry.lastModified ? formatDate(entry.lastModified) : '--'
                                } | ${formatBytes(entry.size || 0)}`
                              : 'Folder'}
                          </div>
                        )}
                      </div>

                      {!isMobile && (
                        <div style={{ color: theme.textSecondary }}>
                          {entry.type === 'file' && entry.lastModified
                            ? formatDate(entry.lastModified)
                            : '--'}
                        </div>
                      )}

                      {!isMobile && (
                        <div
                          style={{
                            color: theme.textSecondary,
                            fontFamily: 'monospace',
                          }}
                        >
                          {entry.type === 'file' ? formatBytes(entry.size || 0) : '--'}
                        </div>
                      )}

                      <div />
                    </div>
                  )
                }

                return (
                  <ContextMenu.Root
                    key={entry.path}
                    onOpenChange={(open) => {
                      if (open) {
                        if (isTrashFolder) return
                        if (!selected.has(entry.path)) {
                          setSelected(new Set([entry.path]))
                          selectionAnchorRef.current = entry.path
                          setLastSelected(null)
                          setIsSelectionMode(true)
                        }
                      }
                    }}
                  >
                    <ContextMenu.Trigger
                      data-entry-path={entry.path}
                      data-entry-selectable={isTrashFolder ? 'false' : 'true'}
                      {...(fileManagerStyles.row ? { className: fileManagerStyles.row } : {})}
                      style={{
                        gridTemplateColumns: isMobile ? '1fr 48px' : '1fr 120px 100px 48px',
                        padding: isMobile ? '12px 16px' : '12px 24px',
                        backgroundColor: isSelected
                          ? theme.selected
                          : isHovered
                            ? theme.hover
                            : theme.bg,
                        outline: 'none',
                      }}
                      onClick={(e) => {
                        if (e.button !== 0) return
                        handleEntryClickWithSelection(entry, index, filteredEntries, e)
                      }}
                      onDoubleClick={() => openEntry(entry)}
                      onContextMenu={(e) => {
                        if (isTrashFolder) {
                          e.preventDefault()
                          e.stopPropagation()
                          return
                        }
                        e.stopPropagation()
                      }}
                      onMouseEnter={() => setHoverRow(entry.path)}
                      onMouseLeave={() => setHoverRow(null)}
                      onTouchStart={() => {
                        if (!isMobile) return
                        if (longPressTimerRef.current)
                          window.clearTimeout(longPressTimerRef.current)
                        longPressTimerRef.current = window.setTimeout(() => {
                          handleLongPressSelect(entry)
                        }, 350)
                      }}
                      onTouchMove={() => {
                        if (longPressTimerRef.current) {
                          window.clearTimeout(longPressTimerRef.current)
                          longPressTimerRef.current = null
                        }
                      }}
                      onTouchEnd={() => {
                        if (longPressTimerRef.current) {
                          window.clearTimeout(longPressTimerRef.current)
                          longPressTimerRef.current = null
                        }
                      }}
                    >
                      {/* Name */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: isMobile ? 'flex-start' : 'center',
                          gap: 12,
                          fontWeight: 500,
                          flexDirection: isMobile ? 'column' : 'row',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          {entry.type === 'folder' ? (
                            isTrashFolder ? (
                              <UiIcon
                                icon={Trash}
                                size={20}
                                weight="fill"
                                color={theme.text}
                                boxed
                              />
                            ) : (
                              <UiIcon
                                icon={Folder}
                                size={20}
                                weight="fill"
                                color={theme.text}
                                boxed
                              />
                            )
                          ) : (
                            (() => {
                              const previewUrl = inlinePreviews[entry.path]
                              if (previewUrl && isImageFileName(entry.name)) {
                                return (
                                  <img
                                    src={previewUrl}
                                    alt={entry.name}
                                    loading="lazy"
                                    decoding="async"
                                    style={{
                                      width: 20,
                                      height: 20,
                                      objectFit: 'cover',
                                      borderRadius: 4,
                                      border: `1px solid ${theme.border}`,
                                    }}
                                  />
                                )
                              }
                              return getFileIcon(entry.name)
                            })()
                          )}
                          {entryLabel}
                        </div>
                        {isMobile && (
                          <div
                            style={{
                              fontSize: 11,
                              color: theme.textSecondary,
                              fontWeight: 400,
                            }}
                          >
                            {entry.type === 'file'
                              ? `${
                                  entry.lastModified ? formatDate(entry.lastModified) : '--'
                                } | ${formatBytes(entry.size || 0)}`
                              : 'Folder'}
                          </div>
                        )}
                      </div>

                      {/* Date */}
                      {!isMobile && (
                        <div style={{ color: theme.textSecondary }}>
                          {entry.type === 'file' && entry.lastModified
                            ? formatDate(entry.lastModified)
                            : '--'}
                        </div>
                      )}

                      {/* Size */}
                      {!isMobile && (
                        <div
                          style={{
                            color: theme.textSecondary,
                            fontFamily: 'monospace',
                          }}
                        >
                          {entry.type === 'file' ? formatBytes(entry.size || 0) : '--'}
                        </div>
                      )}

                      {/* Action Menu */}
                      <div
                        onClick={(e) => {
                          e.stopPropagation()
                          e.preventDefault()
                        }}
                      >
                        <Menu.Root>
                          <Menu.Trigger
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 4,
                              display: 'flex',
                              opacity: isMobile ? 1 : isHovered ? 1 : 0,
                              transition: 'opacity 0.2s',
                              outline: 'none',
                            }}
                          >
                            <UiIcon icon={DotsThree} size={24} color={theme.textSecondary} />
                          </Menu.Trigger>
                          <Menu.Portal container={portalContainer}>
                            <Menu.Positioner
                              side="bottom"
                              align="end"
                              sideOffset={5}
                              style={{ zIndex: 10000 }}
                            >
                              <Menu.Popup
                                style={{
                                  zIndex: 10000,
                                  backgroundColor: theme.bg,
                                  border: `1px solid ${theme.border}`,
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                  padding: 4,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  minWidth: 160,
                                  outline: 'none',
                                }}
                              >
                                {!isMultiSelected && can.rename && (
                                  <Menu.Item
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      padding: '8px 12px',
                                      border: 'none',
                                      background: 'none',
                                      cursor: 'pointer',
                                      fontSize: 13,
                                      textAlign: 'left',
                                      color: theme.text,
                                      outline: 'none',
                                    }}
                                    onClick={() => {
                                      setRenameName(entry.name || '')
                                      setRenameTarget(entry)
                                      setRenameOpen(true)
                                    }}
                                  >
                                    <UiIcon icon={PencilSimple} size={16} /> Rename
                                  </Menu.Item>
                                )}
                                {actionEntries.some((item) => item.type === 'file') && (
                                  <Menu.Item
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      padding: '8px 12px',
                                      border: 'none',
                                      background: 'none',
                                      cursor: 'pointer',
                                      fontSize: 13,
                                      textAlign: 'left',
                                      color: theme.text,
                                      outline: 'none',
                                    }}
                                    onClick={() => bulkDownload(actionEntries)}
                                  >
                                    <UiIcon icon={DownloadSimple} size={16} /> Download
                                  </Menu.Item>
                                )}
                                {isMultiSelected && view === 'files' && can.move && (
                                  <Menu.Item
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      padding: '8px 12px',
                                      border: 'none',
                                      background: 'none',
                                      cursor: 'pointer',
                                      fontSize: 13,
                                      textAlign: 'left',
                                      color: theme.text,
                                      outline: 'none',
                                    }}
                                    onClick={() => bulkMove(actionEntries)}
                                  >
                                    <UiIcon icon={ArrowRight} size={16} /> Move
                                  </Menu.Item>
                                )}
                                {view === 'files' && can.copy && (
                                  <Menu.Item
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      padding: '8px 12px',
                                      border: 'none',
                                      background: 'none',
                                      cursor: 'pointer',
                                      fontSize: 13,
                                      textAlign: 'left',
                                      color: theme.text,
                                      outline: 'none',
                                    }}
                                    onClick={() => bulkCopy(actionEntries)}
                                  >
                                    <UiIcon icon={Copy} size={16} /> Copy
                                  </Menu.Item>
                                )}
                                {isMultiSelected && view === 'trash' && can.restore && (
                                  <Menu.Item
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      padding: '8px 12px',
                                      border: 'none',
                                      background: 'none',
                                      cursor: 'pointer',
                                      fontSize: 13,
                                      textAlign: 'left',
                                      color: theme.text,
                                      outline: 'none',
                                    }}
                                    onClick={() => restoreEntries(actionEntries)}
                                  >
                                    <UiIcon icon={ArrowCounterClockwise} size={16} /> Restore
                                  </Menu.Item>
                                )}
                                {can.delete && (
                                  <Menu.Item
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      padding: '8px 12px',
                                      border: 'none',
                                      background: 'none',
                                      cursor: 'pointer',
                                      fontSize: 13,
                                      textAlign: 'left',
                                      color: theme.danger,
                                      outline: 'none',
                                    }}
                                    onClick={() => {
                                      setSelected(new Set(actionEntries.map((item) => item.path)))
                                      setLastSelected(null)
                                      setIsSelectionMode(true)
                                      setDeleteOpen(true)
                                    }}
                                  >
                                    <UiIcon icon={Trash} size={16} /> Delete
                                  </Menu.Item>
                                )}
                              </Menu.Popup>
                            </Menu.Positioner>
                          </Menu.Portal>
                        </Menu.Root>
                      </div>
                    </ContextMenu.Trigger>

                    <ContextMenu.Portal container={portalContainer}>
                      <ContextMenu.Positioner style={{ zIndex: 10000 }}>
                        <ContextMenu.Popup
                          style={{
                            zIndex: 10000,
                            backgroundColor: theme.bg,
                            border: `1px solid ${theme.border}`,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                            padding: 4,
                            display: 'flex',
                            flexDirection: 'column',
                            minWidth: 160,
                            outline: 'none',
                          }}
                        >
                          {!isMultiSelected && can.rename && (
                            <ContextMenu.Item
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '8px 12px',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                fontSize: 13,
                                textAlign: 'left',
                                color: theme.text,
                                outline: 'none',
                              }}
                              onClick={() => {
                                setRenameName(entry.name || '')
                                setRenameTarget(entry)
                                setRenameOpen(true)
                              }}
                            >
                              <UiIcon icon={PencilSimple} size={16} /> Rename
                            </ContextMenu.Item>
                          )}
                          {actionEntries.some((item) => item.type === 'file') && (
                            <ContextMenu.Item
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '8px 12px',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                fontSize: 13,
                                textAlign: 'left',
                                color: theme.text,
                                outline: 'none',
                              }}
                              onClick={() => bulkDownload(actionEntries)}
                            >
                              <UiIcon icon={DownloadSimple} size={16} /> Download
                            </ContextMenu.Item>
                          )}
                          {isMultiSelected && view === 'files' && can.move && (
                            <ContextMenu.Item
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '8px 12px',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                fontSize: 13,
                                textAlign: 'left',
                                color: theme.text,
                                outline: 'none',
                              }}
                              onClick={() => bulkMove(actionEntries)}
                            >
                              <UiIcon icon={ArrowRight} size={16} /> Move
                            </ContextMenu.Item>
                          )}
                          {view === 'files' && can.copy && (
                            <ContextMenu.Item
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '8px 12px',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                fontSize: 13,
                                textAlign: 'left',
                                color: theme.text,
                                outline: 'none',
                              }}
                              onClick={() => bulkCopy(actionEntries)}
                            >
                              <UiIcon icon={Copy} size={16} /> Copy
                            </ContextMenu.Item>
                          )}
                          {isMultiSelected && view === 'trash' && can.restore && (
                            <ContextMenu.Item
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '8px 12px',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                fontSize: 13,
                                textAlign: 'left',
                                color: theme.text,
                                outline: 'none',
                              }}
                              onClick={() => restoreEntries(actionEntries)}
                            >
                              <UiIcon icon={ArrowCounterClockwise} size={16} /> Restore
                            </ContextMenu.Item>
                          )}
                          {can.delete && (
                            <ContextMenu.Item
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '8px 12px',
                                border: 'none',
                                background: 'none',
                                cursor: 'pointer',
                                fontSize: 13,
                                textAlign: 'left',
                                color: theme.danger,
                                outline: 'none',
                              }}
                              onClick={() => {
                                setSelected(new Set(actionEntries.map((item) => item.path)))
                                setLastSelected(null)
                                setIsSelectionMode(true)
                                setDeleteOpen(true)
                              }}
                            >
                              <UiIcon icon={Trash} size={16} /> Delete
                            </ContextMenu.Item>
                          )}
                        </ContextMenu.Popup>
                      </ContextMenu.Positioner>
                    </ContextMenu.Portal>
                  </ContextMenu.Root>
                )
              })
            })()
          )}

          {/* Load More Button */}
          {(() => {
            const isSearching = searchQuery.trim()
            const hasMoreItems = isSearching ? searchHasMore : hasMore

            if (loadingMore) {
              return (
                <div
                  style={{
                    padding: '20px 24px',
                    textAlign: 'center',
                    borderTop: `1px solid ${theme.border}`,
                    color: theme.textSecondary,
                    fontSize: 13,
                  }}
                >
                  Loading more...
                </div>
              )
            }

            if (hasMoreItems && currentEntries.length > 0) {
              return (
                <div
                  style={{
                    padding: '20px 24px',
                    textAlign: 'center',
                    borderTop: `1px solid ${theme.border}`,
                  }}
                >
                  <Button
                    onClick={() => {
                      if (isSearching) {
                        performSearch(searchQuery, true)
                      } else {
                        refresh(true)
                      }
                    }}
                    disabled={loadingMore}
                    style={{
                      minWidth: 120,
                      opacity: loadingMore ? 0.6 : 1,
                    }}
                    theme={theme}
                  >
                    Load More
                  </Button>
                </div>
              )
            }
            return null
          })()}

          {/* Empty States */}
          {(() => {
            if (currentEntries.length === 0 && !loading && !searching) {
              return (
                <div
                  style={{
                    padding: 40,
                    textAlign: 'center',
                    color: theme.textSecondary,
                  }}
                >
                  {searchQuery.trim() ? (
                    `No results found for "${searchQuery}"`
                  ) : view === 'trash' ? (
                    'Trash is empty'
                  ) : (
                    <div>
                      <div style={{ marginBottom: 16 }}>No files found</div>
                      {can.upload && view === 'files' && (
                        <div
                          style={{
                            fontSize: 12,
                            opacity: 0.7,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 8,
                          }}
                        >
                          <UiIcon icon={UploadSimple} size={16} />
                          Drag and drop files here or click Upload
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            }
            return null
          })()}
        </div>
      </div>

      {/* Right Details Sidebar */}
      {showSidebarOnLayout && previewDisplay && (
        <Dialog.Root
          open={!!previewDisplay}
          onOpenChange={(open) => {
            if (!open) {
              setSelected(new Set())
              setLastSelected(null)
            }
          }}
        >
          <Dialog.Portal container={previewPortalContainer}>
            <Dialog.Backdrop
              style={{
                position: 'absolute',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.04)',
                zIndex: 9,
                pointerEvents: 'auto',
              }}
            />
            <Dialog.Popup
              {...(fileManagerStyles.sidebarRight
                ? { className: fileManagerStyles.sidebarRight }
                : {})}
              style={{
                backgroundColor: theme.bg,
                borderLeft: isSidebarVisible ? `1px solid ${theme.border}` : 'none',
                animation: isPreviewClosing
                  ? 'tokoPreviewSlideOut 200ms ease-in'
                  : 'tokoPreviewSlideIn 200ms ease-out',
                opacity: isSidebarVisible ? 1 : 0,
                pointerEvents: isPreviewClosing ? 'none' : isSidebarVisible ? 'auto' : 'none',
                width: sidebarWidth,
                ...(isSidebarVisible
                  ? {
                      boxShadow: '0 0 0 1px rgba(0,0,0,0.03), -8px 0 24px rgba(0,0,0,0.08)',
                    }
                  : {}),
              }}
            >
              {isSidebarVisible && (
                <div
                  onMouseDown={(e) => {
                    e.preventDefault()
                    setIsResizing(true)
                    updateSidebarWidth(e.clientX)
                  }}
                  onTouchStart={(e) => {
                    const touch = e.touches[0]
                    if (!touch) return
                    setIsResizing(true)
                    updateSidebarWidth(touch.clientX)
                  }}
                  style={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 8,
                    cursor: 'col-resize',
                    zIndex: 2,
                    background: isResizing ? 'rgba(0,0,0,0.06)' : 'transparent',
                  }}
                  aria-hidden
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: 3,
                      top: 0,
                      bottom: 0,
                      width: 2,
                      backgroundColor: isResizing ? theme.textSecondary : theme.border,
                      opacity: 0.4,
                    }}
                  />
                </div>
              )}
              <Dialog.Close
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                  zIndex: 3,
                  background: theme.bg,
                  border: `1px solid ${theme.border}`,
                  borderRadius: 4,
                  padding: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  color: theme.textSecondary,
                }}
                aria-label="Close preview"
                title="Close preview"
              >
                <UiIcon icon={X} size={16} />
              </Dialog.Close>
              <div className={fileManagerStyles.previewBox}>
                {['jpg', 'png', 'gif', 'jpeg', 'webp'].some((ext) =>
                  previewDisplay.entry.path.toLowerCase().endsWith(ext),
                ) ? (
                  <img
                    src={previewDisplay.url}
                    alt="preview"
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      objectFit: 'contain',
                    }}
                  />
                ) : (
                  <UiIcon icon={FileText} size={64} weight="thin" color={theme.textSecondary} />
                )}
              </div>

              <div className={fileManagerStyles.metadata} style={{ color: theme.text }}>
                <h3
                  style={{
                    margin: '0 0 20px',
                    fontSize: 16,
                    fontWeight: 600,
                    color: theme.text,
                  }}
                >
                  {previewDisplay.entry.name}
                </h3>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 20,
                  }}
                >
                  <div className={fileManagerStyles.metaItem}>
                    <div className={fileManagerStyles.metaLabel}>Type</div>
                    <div className={fileManagerStyles.metaValue}>
                      {previewDisplay.entry.name.split('.').pop()?.toUpperCase() || 'FILE'}
                    </div>
                  </div>
                  <div className={fileManagerStyles.metaItem}>
                    <div className={fileManagerStyles.metaLabel}>Size</div>
                    <div className={fileManagerStyles.metaValue}>
                      {previewDisplay.entry.type === 'file'
                        ? formatBytes(previewDisplay.entry.size || 0)
                        : '0 B'}
                    </div>
                  </div>
                </div>

                <div className={fileManagerStyles.metaItem}>
                  <div className={fileManagerStyles.metaLabel}>Location</div>
                  <div className={fileManagerStyles.metaValue}>
                    {getParentPath(previewDisplay.entry.path) || '/'}
                  </div>
                </div>

                <div className={fileManagerStyles.metaItem}>
                  <div className={fileManagerStyles.metaLabel}>Modified</div>
                  <div className={fileManagerStyles.metaValue}>
                    {previewDisplay.entry.type === 'file' && previewDisplay.entry.lastModified
                      ? new Date(previewDisplay.entry.lastModified).toLocaleString()
                      : '--'}
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 20,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  {view === 'files' ? (
                    <>
                      <Button
                        style={{ width: '100%', justifyContent: 'center' }}
                        theme={theme}
                        onClick={async () => {
                          try {
                            const out = await client.getPreviewUrl({
                              path: previewDisplay.entry.path,
                              inline: false,
                            })
                            const link = document.createElement('a')
                            link.href = out.url
                            link.download = previewDisplay.entry.name
                            document.body.appendChild(link)
                            link.click()
                            document.body.removeChild(link)
                          } catch (e) {
                            console.error(e)
                          }
                        }}
                      >
                        <UiIcon icon={DownloadSimple} size={16} /> Download
                      </Button>
                      {can.delete && (
                        <Button
                          variant="danger"
                          onClick={() => {
                            setSelected(new Set([previewDisplay.entry.path]))
                            setLastSelected(previewDisplay.entry)
                            setDeleteOpen(true)
                          }}
                          style={{ width: '100%', justifyContent: 'center' }}
                          theme={theme}
                        >
                          <UiIcon icon={Trash} size={16} /> Delete
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button
                      onClick={onRestore}
                      style={{ width: '100%', justifyContent: 'center' }}
                      theme={theme}
                    >
                      <UiIcon icon={ArrowCounterClockwise} size={16} /> Restore
                    </Button>
                  )}
                </div>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}

      {/* Create Folder Modal */}
      <Modal
        open={createFolderOpen}
        onClose={() => setCreateFolderOpen(false)}
        title="New Folder"
        theme={theme}
        {...(portalContainer ? { portalContainer } : {})}
      >
        <input
          type="text"
          placeholder="Name"
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onCreateFolder()}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: 14,
            border: `1px solid ${theme.border}`,
            outline: 'none',
            backgroundColor: theme.bg,
            color: theme.text,
          }}
          autoFocus
        />
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <Button onClick={() => setCreateFolderOpen(false)} theme={theme}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onCreateFolder} theme={theme}>
            Create Folder
          </Button>
        </div>
      </Modal>

      {/* Rename Modal */}
      <Modal
        open={renameOpen}
        onClose={() => {
          if (isRenaming) return
          setRenameOpen(false)
          setRenameTarget(null)
        }}
        title="Rename"
        theme={theme}
        {...(portalContainer ? { portalContainer } : {})}
        closeDisabled={isRenaming}
      >
        <input
          type="text"
          placeholder="Name"
          value={renameName}
          onChange={(e) => setRenameName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onRename()}
          style={{
            width: '100%',
            padding: '10px',
            fontSize: 14,
            border: `1px solid ${theme.border}`,
            outline: 'none',
            backgroundColor: theme.bg,
            color: theme.text,
          }}
          disabled={isRenaming}
          autoFocus
        />
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <Button onClick={() => setRenameOpen(false)} theme={theme} disabled={isRenaming}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onRename} theme={theme} disabled={isRenaming}>
            {isRenaming ? (
              <>
                <span className={fileManagerStyles.spinner} />
                Renaming...
              </>
            ) : (
              'Rename'
            )}
          </Button>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title={view === 'trash' ? 'Delete Forever' : 'Delete items'}
        theme={theme}
        {...(portalContainer ? { portalContainer } : {})}
        closeDisabled={isDeleting}
      >
        <p style={{ margin: '0 0 20px', color: theme.textSecondary }}>
          Are you sure you want to {view === 'trash' ? 'permanently' : ''} delete {selected.size}{' '}
          item{selected.size > 1 ? 's' : ''}?{view === 'files' && ' (Items will be moved to Trash)'}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button onClick={() => setDeleteOpen(false)} theme={theme} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onDelete} theme={theme} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <span className={fileManagerStyles.spinner} />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </Button>
        </div>
      </Modal>

      {/* Empty Trash Modal */}
      <Modal
        open={emptyTrashOpen}
        onClose={() => setEmptyTrashOpen(false)}
        title="Empty Trash"
        theme={theme}
        {...(portalContainer ? { portalContainer } : {})}
        closeDisabled={isEmptyingTrash}
      >
        <p style={{ margin: '0 0 20px', color: theme.textSecondary }}>
          Are you sure you want to empty the trash? All items will be permanently deleted.
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <Button onClick={() => setEmptyTrashOpen(false)} theme={theme} disabled={isEmptyingTrash}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onEmptyTrash} theme={theme} disabled={isEmptyingTrash}>
            {isEmptyingTrash ? (
              <>
                <span className={fileManagerStyles.spinner} />
                Emptying...
              </>
            ) : (
              'Empty Trash'
            )}
          </Button>
        </div>
      </Modal>

      {/* Drag and Drop Overlay */}
      {isDragOver && view === 'files' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor:
              theme.bg === '#ffffff' ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.05)',
            backdropFilter: 'blur(2px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px dashed ${theme.accent}`,
            margin: 4,
            animation: 'fadeIn 0.2s ease-in-out',
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              backgroundColor: theme.bg,
              border: `1px solid ${theme.border}`,
              color: theme.text,
              fontSize: 16,
              fontWeight: 500,
              transform: 'scale(1.02)',
              transition: 'transform 0.2s ease',
            }}
          >
            <UiIcon icon={UploadSimple} size={48} boxStyle={{ marginBottom: 16, opacity: 0.7 }} />
            <div>Drop files here to upload</div>
            <div style={{ fontSize: 13, color: theme.textSecondary, marginTop: 8 }}>
              Files will be uploaded to {path || 'root directory'}
            </div>
          </div>
        </div>
      )}

      {/* Upload Status Floating Card */}
      {uploadCardOpen &&
        (() => {
          const totalItems = uploadItems.length
          const activeItems = uploadItems.filter((item) => item.status === 'uploading')
          const completedItems = uploadItems.filter((item) => item.status === 'done')
          const failedItems = uploadItems.filter((item) => item.status === 'error')
          const totalBytes = uploadItems.reduce((acc, item) => acc + (item.total || 0), 0)
          const loadedBytes = uploadItems.reduce((acc, item) => acc + (item.loaded || 0), 0)
          const totalPct = totalBytes > 0 ? Math.round((loadedBytes / totalBytes) * 100) : 0
          const hasActiveUploads = activeItems.length > 0

          return (
            <div
              style={{
                position: 'absolute',
                right: 16,
                bottom: 16,
                width: 340,
                maxWidth: 'calc(100% - 32px)',
                backgroundColor: theme.bg,
                border: `1px solid ${theme.border}`,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                padding: 14,
                zIndex: 1200,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 10,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 600 }}>
                  {hasActiveUploads
                    ? `Uploading ${completedItems.length}/${totalItems}`
                    : 'Uploads complete'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 12, color: theme.textSecondary }}>
                    {totalItems} file{totalItems !== 1 ? 's' : ''} • {totalPct}%
                  </div>
                  <button
                    type="button"
                    onClick={() => setUploadCardOpen(false)}
                    disabled={hasActiveUploads}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: hasActiveUploads ? 'not-allowed' : 'pointer',
                      padding: 2,
                      display: 'flex',
                      alignItems: 'center',
                      color: theme.textSecondary,
                      opacity: hasActiveUploads ? 0.5 : 1,
                    }}
                    title={hasActiveUploads ? 'Uploads in progress' : 'Close'}
                  >
                    <UiIcon icon={X} size={14} />
                  </button>
                </div>
              </div>
              {totalItems > 1 && (
                <div
                  style={{
                    height: 6,
                    backgroundColor: theme.bgSecondary,
                    borderRadius: 999,
                    overflow: 'hidden',
                    marginBottom: 10,
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${totalPct}%`,
                      backgroundColor: theme.accent,
                      transition: 'width 120ms linear',
                    }}
                  />
                </div>
              )}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  maxHeight: 220,
                  overflow: 'auto',
                }}
              >
                {uploadItems.map((item) => {
                  const pct = item.total ? Math.round((item.loaded / item.total) * 100) : 0
                  const statusColor =
                    item.status === 'error'
                      ? theme.danger
                      : item.status === 'done'
                        ? theme.text
                        : theme.textSecondary
                  return (
                    <div
                      key={item.path}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 6,
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 10,
                        }}
                      >
                        <div
                          style={{
                            flex: 1,
                            fontSize: 12,
                            color: theme.textSecondary,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.name}
                        </div>
                        <div style={{ fontSize: 11, color: theme.textSecondary }}>
                          {formatBytes(item.loaded)}
                          {item.total ? ` / ${formatBytes(item.total)}` : ''}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            justifyContent: 'flex-end',
                            minWidth: 90,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 12,
                              color: statusColor,
                              minWidth: 42,
                              textAlign: 'right',
                            }}
                          >
                            {item.status === 'error' ? 'Error' : `${pct}%`}
                          </div>
                          {item.status === 'error' && item.file && (
                            <button
                              type="button"
                              onClick={() => retryUpload(item)}
                              style={{
                                background: theme.bg,
                                border: `1px solid ${theme.border}`,
                                color: theme.text,
                                fontSize: 11,
                                padding: '4px 8px',
                                cursor: 'pointer',
                              }}
                            >
                              Retry
                            </button>
                          )}
                        </div>
                      </div>
                      <div
                        style={{
                          width: '100%',
                          height: 6,
                          backgroundColor: theme.bgSecondary,
                          borderRadius: 999,
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            height: '100%',
                            width: `${item.status === 'error' ? 100 : pct}%`,
                            backgroundColor: item.status === 'error' ? theme.danger : theme.accent,
                            transition: 'width 120ms linear',
                          }}
                        />
                      </div>
                      {item.status === 'error' && item.error && (
                        <div style={{ fontSize: 11, color: theme.danger }}>{item.error}</div>
                      )}
                    </div>
                  )
                })}
                {failedItems.length > 0 && (
                  <div style={{ fontSize: 11, color: theme.danger }}>
                    {failedItems.length} upload
                    {failedItems.length !== 1 ? 's' : ''} failed
                  </div>
                )}
              </div>
            </div>
          )
        })()}

      {/* Drag Overlay for Trash (Not Allowed) */}
      {isDragOver && view === 'trash' && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor:
              theme.bg === '#ffffff' ? 'rgba(220, 38, 38, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            backdropFilter: 'blur(2px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: `2px dashed ${theme.danger}`,
            margin: 4,
          }}
        >
          <div
            style={{
              textAlign: 'center',
              padding: 40,
              backgroundColor: theme.bg,
              border: `1px solid ${theme.border}`,
              color: theme.danger,
              fontSize: 16,
              fontWeight: 500,
            }}
          >
            <UiIcon icon={Warning} size={48} boxStyle={{ marginBottom: 16, opacity: 0.7 }} />
            <div>Cannot upload to trash</div>
            <div style={{ fontSize: 13, color: theme.textSecondary, marginTop: 8 }}>
              Switch to files view to upload
            </div>
          </div>
        </div>
      )}
      <div ref={previewPortalRef} className={fileManagerStyles.previewPortal} />
    </div>
  )
}
