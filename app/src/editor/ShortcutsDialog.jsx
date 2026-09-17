import React from 'react'
import { useI18n } from '../i18n/index.js'
import Modal from '../components/Modal.jsx'

const GROUPS = [
  { key: 'general', rows: [['Ctrl+Z', 'common.undo'], ['Ctrl+Y', 'common.redo'], ['Ctrl+0', 'editor.zoomFit'], ['Ctrl++ / Ctrl+-', 'editor.zoomIn'], ['F5', 'editor.preview'], ['Esc', 'common.cancel']] },
  { key: 'selection', rows: [['Ctrl+A', 'editor.elements'], ['Ctrl+D', 'common.duplicate'], ['Ctrl+C / X / V', 'common.copy'], ['Delete', 'common.delete'], ['Enter', 'editor.editText'], ['↑ ↓ ← →  (Shift ×10)', 'inspector.position'], ['Ctrl+] / Ctrl+[', 'inspector.layer'], ['Shift + drag', 'inspector.size']] },
  { key: 'slides', rows: [['PageUp / PageDown', 'editor.slide'], ['Double click', 'editor.editText']] },
]

export default function ShortcutsDialog({ onClose }) {
  const { t } = useI18n()
  return (
    <Modal open onClose={onClose} size="lg" title={t('shortcuts.title')}>
      <div className="shortcut-groups">
        {GROUPS.map((g) => (
          <div key={g.key}>
            <h4>{t(`shortcuts.groups.${g.key}`)}</h4>
            {g.rows.map(([keys, label]) => (
              <div key={keys} className="shortcut-row"><span>{t(label)}</span><span className="kbd">{keys}</span></div>
            ))}
          </div>
        ))}
      </div>
    </Modal>
  )
}
