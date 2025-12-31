import { FileManager } from './FileManager'
import type { FileManagerProps } from './types/fileManager'

export interface FilePickerProps extends Omit<FileManagerProps, 'mode' | 'selection'> {
  selection?: 'single' | 'multiple'
}

export function FilePicker({
  selection = 'single',
  allowActions,
  confirmLabel = 'Select',
  ...props
}: FilePickerProps) {
  return (
    <FileManager
      {...props}
      mode="picker"
      selection={selection}
      confirmLabel={confirmLabel}
      allowActions={{
        upload: true,
        createFolder: true,
        delete: false,
        rename: false,
        move: false,
        copy: false,
        restore: false,
        ...allowActions,
      }}
    />
  )
}
