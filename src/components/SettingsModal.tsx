import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { Modal } from './Modal';
import { api } from '../api';
import { useToast } from './Toasts';

export function SettingsModal({ onImported, onClose }: { onImported: () => void; onClose: () => void }) {
  const toast = useToast();
  const file = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  const [busy, setBusy] = useState(false);

  const exportJson = async () => {
    try {
      const data = await api.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `promptcentral-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Export failed', 'error');
    }
  };

  const importJson = async (selected: File) => {
    setBusy(true);
    try {
      const data = JSON.parse(await selected.text());
      const result = await api.importAll(data, mode);
      toast(`Imported ${result.prompts} prompts`);
      onImported();
      onClose();
    } catch (err) {
      toast(err instanceof SyntaxError ? 'That file is not valid JSON' : err instanceof Error ? err.message : 'Import failed', 'error');
    } finally {
      setBusy(false);
      if (file.current) file.current.value = '';
    }
  };

  return (
    <Modal title="Import / export" onClose={onClose} size="sm">
      <div className="stack">
        <section className="settings-block">
          <h3>Export</h3>
          <p className="muted">Download every prompt and category as one JSON file.</p>
          <button className="btn btn-ghost" onClick={exportJson} data-autofocus>
            <Download size={16} /> Download backup
          </button>
        </section>
        <section className="settings-block">
          <h3>Import</h3>
          <p className="muted">Load a PromptCentral JSON backup.</p>
          <div className="radio-row">
            <label>
              <input type="radio" checked={mode === 'merge'} onChange={() => setMode('merge')} /> Add to my library
            </label>
            <label>
              <input type="radio" checked={mode === 'replace'} onChange={() => setMode('replace')} /> Replace everything
            </label>
          </div>
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])}
          />
          <button className={`btn ${mode === 'replace' ? 'btn-danger' : 'btn-ghost'}`} disabled={busy} onClick={() => file.current?.click()}>
            <Upload size={16} /> {busy ? 'Importing…' : 'Choose file'}
          </button>
        </section>
      </div>
    </Modal>
  );
}
