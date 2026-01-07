'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button as BaseButton, Input, Select, Switch, Toast } from '@base-ui/react'
import { FileManager } from 's3kit/react'
import styles from './Customizer.module.css'

const defaultLabels = {
  upload: 'Upload',
  newFolder: 'New Folder',
  delete: 'Delete',
  deleteForever: 'Delete Forever',
  restore: 'Restore',
  emptyTrash: 'Empty Trash',
  confirm: 'Select',
  searchPlaceholder: 'Search files and folders...',
}

const defaultToolbar = {
  search: true,
  viewSwitcher: true,
  sort: true,
  breadcrumbs: true,
}

const defaultActions = {
  upload: true,
  createFolder: true,
  delete: true,
  rename: true,
  move: true,
  copy: true,
  restore: true,
}

const defaultConfig = {
  mode: 'manager' as const,
  selection: 'multiple' as const,
  viewMode: 'grid' as const,
  theme: 'system' as const,
  apiUrl: '/api/s3',
  hideTrash: false,
  filterExtensionsInput: '',
  filterMimeTypesInput: '',
}

const hasOverrides = <T extends Record<string, unknown>>(current: T, defaults: T) =>
  Object.entries(defaults).some(([key, value]) => current[key as keyof T] !== value)

const setParamIfChanged = (
  params: URLSearchParams,
  key: string,
  value: string,
  defaultValue: string,
) => {
  if (value !== defaultValue) {
    params.set(key, value)
  }
}

const setParamIfNonEmpty = (params: URLSearchParams, key: string, value: string) => {
  if (value.trim()) {
    params.set(key, value)
  }
}

const parseBooleanParam = (value: string | null, fallback: boolean) => {
  if (value === '1') return true
  if (value === '0') return false
  return fallback
}

const setBooleanParamIfChanged = (
  params: URLSearchParams,
  key: string,
  value: boolean,
  defaultValue: boolean,
) => {
  if (value !== defaultValue) {
    params.set(key, value ? '1' : '0')
  }
}

const toastTimeoutMs = 2200

export default function CustomizerPage() {
  return (
    <Toast.Provider timeout={toastTimeoutMs}>
      <CustomizerContent />
    </Toast.Provider>
  )
}

function CustomizerContent() {
  const portalContainerRef = useRef<HTMLDivElement | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [labels, setLabels] = useState(defaultLabels)
  const [toolbar, setToolbar] = useState(defaultToolbar)
  const [panelOpen, setPanelOpen] = useState(false)
  const [mode, setMode] = useState<'viewer' | 'picker' | 'manager'>(defaultConfig.mode)
  const [selection, setSelection] = useState<'single' | 'multiple'>(defaultConfig.selection)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(defaultConfig.viewMode)
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(defaultConfig.theme)
  const [prefersDark, setPrefersDark] = useState(false)
  const [apiUrl, setApiUrl] = useState(defaultConfig.apiUrl)
  const [hideTrash, setHideTrash] = useState(defaultConfig.hideTrash)
  const [filterExtensionsInput, setFilterExtensionsInput] = useState(
    defaultConfig.filterExtensionsInput,
  )
  const [filterMimeTypesInput, setFilterMimeTypesInput] = useState(
    defaultConfig.filterMimeTypesInput,
  )
  const [allowActions, setAllowActions] = useState(defaultActions)
  const [copied, setCopied] = useState(false)
  const { toasts, add: addToast } = Toast.useToastManager()

  const filterExtensions = useMemo(() => {
    const values = filterExtensionsInput
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    return values.length ? values : undefined
  }, [filterExtensionsInput])

  const filterMimeTypes = useMemo(() => {
    const values = filterMimeTypesInput
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
    return values.length ? values : undefined
  }, [filterMimeTypesInput])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    setMode((params.get('mode') as 'viewer' | 'picker' | 'manager' | null) ?? defaultConfig.mode)
    setSelection(
      (params.get('selection') as 'single' | 'multiple' | null) ?? defaultConfig.selection,
    )
    setViewMode((params.get('view') as 'list' | 'grid' | null) ?? defaultConfig.viewMode)
    setTheme((params.get('theme') as 'light' | 'dark' | 'system' | null) ?? defaultConfig.theme)
    setApiUrl(params.get('api') ?? defaultConfig.apiUrl)
    setHideTrash(parseBooleanParam(params.get('hideTrash'), defaultConfig.hideTrash))
    setFilterExtensionsInput(params.get('ext') ?? '')
    setFilterMimeTypesInput(params.get('mime') ?? '')
    setLabels((prev) => {
      const next = { ...prev }
      Object.keys(defaultLabels).forEach((key) => {
        const paramValue = params.get(`label_${key}`)
        if (paramValue !== null) {
          next[key as keyof typeof defaultLabels] = paramValue
        }
      })
      return next
    })
    setToolbar((prev) => {
      const next = { ...prev }
      Object.keys(defaultToolbar).forEach((key) => {
        const paramValue = params.get(`toolbar_${key}`)
        if (paramValue !== null) {
          next[key as keyof typeof defaultToolbar] = parseBooleanParam(
            paramValue,
            defaultToolbar[key as keyof typeof defaultToolbar],
          )
        }
      })
      return next
    })
    setAllowActions((prev) => {
      const next = { ...prev }
      Object.keys(defaultActions).forEach((key) => {
        const paramValue = params.get(`action_${key}`)
        if (paramValue !== null) {
          next[key as keyof typeof defaultActions] = parseBooleanParam(
            paramValue,
            defaultActions[key as keyof typeof defaultActions],
          )
        }
      })
      return next
    })
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setPrefersDark(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isInitialized) {
      setIsInitialized(true)
      return
    }
    const params = new URLSearchParams()
    setParamIfChanged(params, 'mode', mode, defaultConfig.mode)
    setParamIfChanged(params, 'selection', selection, defaultConfig.selection)
    setParamIfChanged(params, 'view', viewMode, defaultConfig.viewMode)
    setParamIfChanged(params, 'theme', theme, defaultConfig.theme)
    setParamIfChanged(params, 'api', apiUrl, defaultConfig.apiUrl)
    setBooleanParamIfChanged(params, 'hideTrash', hideTrash, defaultConfig.hideTrash)
    setParamIfNonEmpty(params, 'ext', filterExtensionsInput)
    setParamIfNonEmpty(params, 'mime', filterMimeTypesInput)
    if (hasOverrides(labels, defaultLabels)) {
      Object.entries(labels).forEach(([key, value]) => {
        if (value !== defaultLabels[key as keyof typeof defaultLabels]) {
          params.set(`label_${key}`, value)
        }
      })
    }
    if (hasOverrides(toolbar, defaultToolbar)) {
      Object.entries(toolbar).forEach(([key, value]) => {
        setBooleanParamIfChanged(
          params,
          `toolbar_${key}`,
          value,
          defaultToolbar[key as keyof typeof defaultToolbar],
        )
      })
    }
    if (hasOverrides(allowActions, defaultActions)) {
      Object.entries(allowActions).forEach(([key, value]) => {
        setBooleanParamIfChanged(
          params,
          `action_${key}`,
          value,
          defaultActions[key as keyof typeof defaultActions],
        )
      })
    }
    const nextQuery = params.toString()
    const nextUrl = nextQuery
      ? `${window.location.pathname}?${nextQuery}`
      : window.location.pathname
    window.history.replaceState({}, '', nextUrl)
  }, [
    allowActions,
    apiUrl,
    filterExtensionsInput,
    filterMimeTypesInput,
    hideTrash,
    isInitialized,
    labels,
    mode,
    selection,
    theme,
    toolbar,
    viewMode,
  ])

  const showToast = (message: string) => {
    addToast({
      title: 'Selected file',
      description: message,
    })
  }

  const resolvedTheme = theme === 'system' ? (prefersDark ? 'dark' : 'light') : theme

  const jsxSnippet = useMemo(() => {
    const toJsArray = (items?: string[]) =>
      items ? `[${items.map((item) => `'${item}'`).join(', ')}]` : 'undefined'

    return `import { FileManager } from 's3kit/react';

export function FileManagerDemo() {
  return (
    <FileManager
      apiUrl="${apiUrl}"
      theme="${theme}"
      mode="${mode}"
      selection="${selection}"
      viewMode="${viewMode}"
      toolbar={{
        search: ${toolbar.search},
        viewSwitcher: ${toolbar.viewSwitcher},
        sort: ${toolbar.sort},
        breadcrumbs: ${toolbar.breadcrumbs},
      }}
      labels={{
        upload: "${labels.upload}",
        newFolder: "${labels.newFolder}",
        delete: "${labels.delete}",
        deleteForever: "${labels.deleteForever}",
        restore: "${labels.restore}",
        emptyTrash: "${labels.emptyTrash}",
        confirm: "${labels.confirm}",
        searchPlaceholder: "${labels.searchPlaceholder}",
      }}
      hideTrash={${hideTrash}}
      filterExtensions={${toJsArray(filterExtensions)}}
      filterMimeTypes={${toJsArray(filterMimeTypes)}}
      allowActions={{
        upload: ${allowActions.upload},
        createFolder: ${allowActions.createFolder},
        delete: ${allowActions.delete},
        rename: ${allowActions.rename},
        move: ${allowActions.move},
        copy: ${allowActions.copy},
        restore: ${allowActions.restore},
      }}
    />
  );
}
`
  }, [
    allowActions,
    apiUrl,
    filterExtensions,
    filterMimeTypes,
    hideTrash,
    labels,
    mode,
    selection,
    theme,
    toolbar,
    viewMode,
  ])

  const labelEntries = useMemo(
    () => [
      { key: 'upload', label: 'Upload button' },
      { key: 'newFolder', label: 'New folder button' },
      { key: 'delete', label: 'Delete button' },
      { key: 'deleteForever', label: 'Delete forever button' },
      { key: 'restore', label: 'Restore button' },
      { key: 'emptyTrash', label: 'Empty trash button' },
      { key: 'confirm', label: 'Confirm button' },
      { key: 'searchPlaceholder', label: 'Search placeholder' },
    ],
    [],
  )

  return (
    <div
      className={styles.layout}
      ref={portalContainerRef}
      style={
        (resolvedTheme === 'dark'
          ? {
              '--customizer-bg': '#0a0a0b',
              '--customizer-panel': '#121316',
              '--customizer-text': '#f8fafc',
              '--customizer-muted': '#a5b4c8',
              '--customizer-muted-strong': '#d1d5db',
              '--customizer-border': '#23242a',
              '--customizer-border-strong': '#2f3138',
              '--customizer-frame-border': '#4b5563',
              '--customizer-hover': '#1b1d22',
              '--customizer-track': '#23242a',
              '--customizer-primary': '#ffffff',
              '--customizer-primary-hover': '#e5e7eb',
              '--customizer-on-primary': '#0a0a0b',
              '--customizer-frame': '#0f1115',
              '--customizer-frame-inner': '#1b1f26',
              '--customizer-frame-accent': '#3f4550',
            }
          : {
              '--customizer-bg': '#f8fafc',
              '--customizer-panel': '#ffffff',
              '--customizer-text': '#0f172a',
              '--customizer-muted': '#94a3b8',
              '--customizer-muted-strong': '#475569',
              '--customizer-border': '#e2e8f0',
              '--customizer-border-strong': '#cbd5f5',
              '--customizer-frame-border': '#cbd5e1',
              '--customizer-hover': '#f1f5f9',
              '--customizer-track': '#e2e8f0',
              '--customizer-primary': '#000000',
              '--customizer-primary-hover': '#0f172a',
              '--customizer-on-primary': '#ffffff',
              '--customizer-frame': '#0f172a',
              '--customizer-frame-inner': '#1e293b',
              '--customizer-frame-accent': '#475569',
            }) as React.CSSProperties
      }
    >
      <div className={styles.shell}>
        <aside
          className={`${styles.panel} ${styles.panelMobile}${
            panelOpen ? ` ${styles.panelOpen}` : ''
          }`}
        >
          <div className={styles.panelCard}>
            <div className={styles.panelBody}>
              <div className={styles.panelStack}>
                <section className={styles.section}>
                  <div className={styles.sectionTitle}>Preview</div>
                  <div className={styles.fieldGridTwo}>
                    <label className={styles.fieldLabel}>
                      <span className={styles.fieldHint}>Mode</span>
                      <Select.Root
                        value={mode}
                        onValueChange={(value) => setMode(value as 'viewer' | 'picker' | 'manager')}
                      >
                        <Select.Trigger className={styles.controlTrigger}>
                          <Select.Value className={styles.valueText} />
                          <Select.Icon className={styles.iconMuted}>
                            <svg
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-4 w-4"
                              aria-hidden
                            >
                              <path
                                fillRule="evenodd"
                                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </Select.Icon>
                        </Select.Trigger>
                        <Select.Portal container={portalContainerRef}>
                          <Select.Positioner sideOffset={6} className={styles.selectPositioner}>
                            <Select.Popup className={styles.selectPopup}>
                              <Select.List className={styles.selectList}>
                                <Select.Item value="viewer" className={styles.selectItem}>
                                  <Select.ItemText>Viewer (read-only)</Select.ItemText>
                                  <Select.ItemIndicator className={styles.indicator}>
                                    ✓
                                  </Select.ItemIndicator>
                                </Select.Item>
                                <Select.Item value="picker" className={styles.selectItem}>
                                  <Select.ItemText>Picker</Select.ItemText>
                                  <Select.ItemIndicator className={styles.indicator}>
                                    ✓
                                  </Select.ItemIndicator>
                                </Select.Item>
                                <Select.Item value="manager" className={styles.selectItem}>
                                  <Select.ItemText>Manager</Select.ItemText>
                                  <Select.ItemIndicator className={styles.indicator}>
                                    ✓
                                  </Select.ItemIndicator>
                                </Select.Item>
                              </Select.List>
                            </Select.Popup>
                          </Select.Positioner>
                        </Select.Portal>
                      </Select.Root>
                    </label>

                    <label className={styles.fieldLabel}>
                      <span className={styles.fieldHint}>Theme</span>
                      <Select.Root
                        value={theme}
                        onValueChange={(value) => setTheme(value as 'light' | 'dark' | 'system')}
                      >
                        <Select.Trigger className={styles.controlTrigger}>
                          <Select.Value className={styles.valueText} />
                          <Select.Icon className={styles.iconMuted}>
                            <svg
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-4 w-4"
                              aria-hidden
                            >
                              <path
                                fillRule="evenodd"
                                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </Select.Icon>
                        </Select.Trigger>
                        <Select.Portal container={portalContainerRef}>
                          <Select.Positioner sideOffset={6} className={styles.selectPositioner}>
                            <Select.Popup className={styles.selectPopup}>
                              <Select.List className={styles.selectList}>
                                <Select.Item value="light" className={styles.selectItem}>
                                  <Select.ItemText>Light</Select.ItemText>
                                  <Select.ItemIndicator className={styles.indicator}>
                                    ✓
                                  </Select.ItemIndicator>
                                </Select.Item>
                                <Select.Item value="dark" className={styles.selectItem}>
                                  <Select.ItemText>Dark</Select.ItemText>
                                  <Select.ItemIndicator className={styles.indicator}>
                                    ✓
                                  </Select.ItemIndicator>
                                </Select.Item>
                                <Select.Item value="system" className={styles.selectItem}>
                                  <Select.ItemText>System</Select.ItemText>
                                  <Select.ItemIndicator className={styles.indicator}>
                                    ✓
                                  </Select.ItemIndicator>
                                </Select.Item>
                              </Select.List>
                            </Select.Popup>
                          </Select.Positioner>
                        </Select.Portal>
                      </Select.Root>
                    </label>
                  </div>

                  <div className={styles.fieldGridTwo}>
                    <label className={styles.fieldLabel}>
                      <span className={styles.fieldHint}>Selection</span>
                      <Select.Root
                        value={selection}
                        onValueChange={(value) => setSelection(value as 'single' | 'multiple')}
                        disabled={mode === 'viewer'}
                      >
                        <Select.Trigger className={styles.controlTrigger}>
                          <Select.Value className={styles.valueText} />
                          <Select.Icon className={styles.iconMuted}>
                            <svg
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-4 w-4"
                              aria-hidden
                            >
                              <path
                                fillRule="evenodd"
                                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </Select.Icon>
                        </Select.Trigger>
                        <Select.Portal container={portalContainerRef}>
                          <Select.Positioner sideOffset={6} className={styles.selectPositioner}>
                            <Select.Popup className={styles.selectPopup}>
                              <Select.List className={styles.selectList}>
                                <Select.Item value="single" className={styles.selectItem}>
                                  <Select.ItemText>Single</Select.ItemText>
                                  <Select.ItemIndicator className={styles.indicator}>
                                    ✓
                                  </Select.ItemIndicator>
                                </Select.Item>
                                <Select.Item value="multiple" className={styles.selectItem}>
                                  <Select.ItemText>Multiple</Select.ItemText>
                                  <Select.ItemIndicator className={styles.indicator}>
                                    ✓
                                  </Select.ItemIndicator>
                                </Select.Item>
                              </Select.List>
                            </Select.Popup>
                          </Select.Positioner>
                        </Select.Portal>
                      </Select.Root>
                    </label>

                    <label className={styles.fieldLabel}>
                      <span className={styles.fieldHint}>View</span>
                      <Select.Root
                        value={viewMode}
                        onValueChange={(value) => setViewMode(value as 'list' | 'grid')}
                      >
                        <Select.Trigger className={styles.controlTrigger}>
                          <Select.Value className={styles.valueText} />
                          <Select.Icon className={styles.iconMuted}>
                            <svg
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="h-4 w-4"
                              aria-hidden
                            >
                              <path
                                fillRule="evenodd"
                                d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.25a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </Select.Icon>
                        </Select.Trigger>
                        <Select.Portal container={portalContainerRef}>
                          <Select.Positioner sideOffset={6} className={styles.selectPositioner}>
                            <Select.Popup className={styles.selectPopup}>
                              <Select.List className={styles.selectList}>
                                <Select.Item value="grid" className={styles.selectItem}>
                                  <Select.ItemText>Grid</Select.ItemText>
                                  <Select.ItemIndicator className={styles.indicator}>
                                    ✓
                                  </Select.ItemIndicator>
                                </Select.Item>
                                <Select.Item value="list" className={styles.selectItem}>
                                  <Select.ItemText>List</Select.ItemText>
                                  <Select.ItemIndicator className={styles.indicator}>
                                    ✓
                                  </Select.ItemIndicator>
                                </Select.Item>
                              </Select.List>
                            </Select.Popup>
                          </Select.Positioner>
                        </Select.Portal>
                      </Select.Root>
                    </label>
                  </div>
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionTitle}>Toolbar</div>
                  <div className={styles.toggleGrid}>
                    {Object.entries(toolbar).map(([key, value]) => (
                      <label key={key} className={styles.toggleItem}>
                        <span className={styles.toggleLabel}>{key}</span>
                        <Switch.Root
                          checked={value}
                          onCheckedChange={(checked) =>
                            setToolbar((prev) => ({ ...prev, [key]: checked }))
                          }
                          className={styles.switchRoot}
                        >
                          <Switch.Thumb className={styles.switchThumb} />
                        </Switch.Root>
                      </label>
                    ))}
                  </div>
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionTitle}>Actions</div>
                  <div className={styles.toggleGrid}>
                    {Object.entries(allowActions).map(([key, value]) => (
                      <label key={key} className={styles.toggleItem}>
                        <span className={styles.toggleLabel}>{key}</span>
                        <Switch.Root
                          checked={value}
                          onCheckedChange={(checked) =>
                            setAllowActions((prev) => ({
                              ...prev,
                              [key]: checked,
                            }))
                          }
                          className={styles.switchRoot}
                        >
                          <Switch.Thumb className={styles.switchThumb} />
                        </Switch.Root>
                      </label>
                    ))}
                  </div>
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionTitle}>Filters</div>
                  <div className={styles.stackSm}>
                    <label className={styles.fieldLabel}>
                      <span className={styles.fieldHint}>Extensions (comma-separated)</span>
                      <Input
                        value={filterExtensionsInput}
                        onValueChange={setFilterExtensionsInput}
                        placeholder="jpg,png,pdf"
                        className={styles.input}
                      />
                    </label>
                    <label className={styles.fieldLabel}>
                      <span className={styles.fieldHint}>MIME types (comma-separated)</span>
                      <Input
                        value={filterMimeTypesInput}
                        onValueChange={setFilterMimeTypesInput}
                        placeholder="image/jpeg,application/pdf"
                        className={styles.input}
                      />
                    </label>
                    <label className={styles.toggleItem}>
                      <span>Hide trash</span>
                      <Switch.Root
                        checked={hideTrash}
                        onCheckedChange={setHideTrash}
                        className={styles.switchRoot}
                      >
                        <Switch.Thumb className={styles.switchThumb} />
                      </Switch.Root>
                    </label>
                  </div>
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionTitle}>API</div>
                  <label className={styles.fieldLabel}>
                    <span className={styles.fieldHint}>API URL</span>
                    <Input value={apiUrl} onValueChange={setApiUrl} className={styles.input} />
                  </label>
                </section>

                <section className={styles.section}>
                  <div className={styles.sectionTitle}>Labels</div>
                  <div className={styles.stackXs}>
                    {labelEntries.map(({ key, label }) => (
                      <label key={key} className={styles.fieldLabel}>
                        <span className={styles.fieldHint}>{label}</span>
                        <Input
                          value={labels[key as keyof typeof labels]}
                          onValueChange={(value) =>
                            setLabels((prev) => ({ ...prev, [key]: value }))
                          }
                          className={styles.input}
                        />
                      </label>
                    ))}
                  </div>
                </section>
              </div>
            </div>

            <div className={styles.panelFooter}>
              <div className={styles.footerStack}>
                <BaseButton
                  className={styles.primaryButton}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(jsxSnippet)
                      setCopied(true)
                      setTimeout(() => setCopied(false), 1800)
                    } catch {
                      setCopied(false)
                    }
                  }}
                >
                  {copied ? 'Copied JSX' : 'Copy JSX'}
                </BaseButton>
                <div className={styles.footerRow}>
                  <BaseButton
                    className={styles.resetButton}
                    onClick={() => {
                      setLabels(defaultLabels)
                      setToolbar(defaultToolbar)
                      setMode('manager')
                      setSelection('multiple')
                      setViewMode('grid')
                      setTheme('system')
                      setApiUrl('/api/s3')
                      setHideTrash(false)
                      setFilterExtensionsInput('')
                      setFilterMimeTypesInput('')
                      setAllowActions({
                        upload: true,
                        createFolder: true,
                        delete: true,
                        rename: true,
                        move: true,
                        copy: true,
                        restore: true,
                      })
                    }}
                  >
                    Reset defaults
                  </BaseButton>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <main className={styles.previewArea}>
          {panelOpen && <div className={styles.overlay} onClick={() => setPanelOpen(false)} />}
          <div className={styles.mobileCta}>
            <BaseButton className={styles.mobileCtaButton} onClick={() => setPanelOpen(true)}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
                <path d="M3 5.5a.75.75 0 0 1 .75-.75h12.5a.75.75 0 1 1 0 1.5H3.75A.75.75 0 0 1 3 5.5zm0 4.5a.75.75 0 0 1 .75-.75h12.5a.75.75 0 1 1 0 1.5H3.75A.75.75 0 0 1 3 10zm0 4.5a.75.75 0 0 1 .75-.75h12.5a.75.75 0 1 1 0 1.5H3.75A.75.75 0 0 1 3 14.5z" />
              </svg>
              Customize
            </BaseButton>
          </div>
          <div className={styles.previewWrap}>
            <div className={styles.deviceFrame}>
              <div className={styles.deviceNotch}>
                <div className={styles.deviceNotchInner} />
              </div>
              <div className={styles.deviceScreen}>
                <div className={styles.previewHeight}>
                  <FileManager
                    apiUrl={apiUrl}
                    theme={theme}
                    mode={mode}
                    selection={selection}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onConfirm={(entries) => {
                      if (mode !== 'picker') return
                      console.log('Selection confirmed:', entries)
                      if (entries.length === 0) return
                      const names = entries.map((entry) => entry.name).join(', ')
                      showToast(names)
                    }}
                    toolbar={toolbar}
                    labels={labels}
                    hideTrash={hideTrash}
                    filterExtensions={filterExtensions}
                    filterMimeTypes={filterMimeTypes}
                    className={`${styles.previewManager} h-full w-full border-none rounded-none`}
                    style={{ overflow: 'hidden' }}
                    allowActions={{
                      upload: mode !== 'viewer' && allowActions.upload,
                      createFolder: mode !== 'viewer' && allowActions.createFolder,
                      delete: mode === 'manager' && allowActions.delete,
                      rename: mode === 'manager' && allowActions.rename,
                      move: mode === 'manager' && allowActions.move,
                      copy: mode === 'manager' && allowActions.copy,
                      restore: mode === 'manager' && allowActions.restore,
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <Toast.Portal container={portalContainerRef.current ?? undefined}>
        <Toast.Viewport className={styles.toastViewport}>
          {toasts.map((toast) => (
            <Toast.Root key={toast.id} toast={toast} className={styles.toastRoot}>
              <Toast.Content className={styles.toastContent}>
                <Toast.Title className={styles.toastTitle} />
                <Toast.Description className={styles.toastDescription} />
                <Toast.Close className={styles.toastClose} aria-label="Close">
                  <span className={styles.toastCloseIcon} aria-hidden>
                    ×
                  </span>
                </Toast.Close>
              </Toast.Content>
            </Toast.Root>
          ))}
        </Toast.Viewport>
      </Toast.Portal>
    </div>
  )
}
