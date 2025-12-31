'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button as BaseButton, Input, Select, Switch } from '@base-ui/react'
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

export default function CustomizerPage() {
  const portalContainerRef = useRef<HTMLDivElement | null>(null)
  const [labels, setLabels] = useState(defaultLabels)
  const [toolbar, setToolbar] = useState(defaultToolbar)
  const [panelOpen, setPanelOpen] = useState(false)
  const [mode, setMode] = useState<'viewer' | 'picker' | 'manager'>('manager')
  const [selection, setSelection] = useState<'single' | 'multiple'>('multiple')
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('grid')
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')
  const [prefersDark, setPrefersDark] = useState(false)
  const [apiUrl, setApiUrl] = useState('/api/s3')
  const [hideTrash, setHideTrash] = useState(false)
  const [filterExtensionsInput, setFilterExtensionsInput] = useState('')
  const [filterMimeTypesInput, setFilterMimeTypesInput] = useState('')
  const [allowActions, setAllowActions] = useState({
    upload: true,
    createFolder: true,
    delete: true,
    rename: true,
    move: true,
    copy: true,
    restore: true,
  })
  const [copied, setCopied] = useState(false)

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
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const update = () => setPrefersDark(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

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
            <div className={styles.panelHeader}>
              <h1 className={styles.panelTitle}>Customizer</h1>
              <p className={styles.panelSubtitle}>Configure UI and copy JSX.</p>
            </div>

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
                <BaseButton
                  className={styles.secondaryButton}
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
    </div>
  )
}
