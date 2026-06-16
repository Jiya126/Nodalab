import { useState } from 'react';
import Editor from '@monaco-editor/react';
import { useGraphStore } from '../store/graphStore';
import { useUIStore } from '../store/uiStore';
import { useCustomBlockStore } from '../store/customBlockStore';
import { Play, AlertCircle, CheckCircle, Save } from 'lucide-react';

export default function CustomBlockEditor() {
  const selectedNodeId = useUIStore(s => s.selectedNodeId);
  const nodes = useGraphStore(s => s.nodes);
  const updateNodeParams = useGraphStore(s => s.updateNodeParams);
  const saveCustomBlock = useCustomBlockStore(s => s.saveCustomBlock);

  const [validationResult, setValidationResult] = useState<{
    valid: boolean;
    errors: string[];
    generated_wrapper?: string | null;
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const node = nodes.find(n => n.id === selectedNodeId);
  if (!node || node.data.blockType !== 'Custom') return null;

  const code = (node.data.params.code as string) || 'return x';

  const handleCodeChange = (value: string | undefined) => {
    if (value !== undefined) {
      updateNodeParams(node.id, { code: value });
    }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      const response = await fetch('/api/validate/custom-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code,
          input_names: ['x'],
          output_names: ['out'],
          params: {},
        }),
      });
      const result = await response.json();
      setValidationResult(result);
    } catch {
      setValidationResult({
        valid: false,
        errors: ['Could not connect to backend. Make sure the server is running.'],
      });
    }
    setIsValidating(false);
  };

  const handleSavePreset = () => {
    const defaultName = node.data.label.replace(/_\d+$/, '');
    const name = window.prompt('Name this reusable custom block:', defaultName);
    if (!name?.trim()) return;

    const saved = saveCustomBlock({
      name,
      description: `Custom forward: ${code.split('\n')[0]?.trim() || 'return x'}`,
      params: node.data.params,
    });
    setSavedMessage(`Saved as ${saved.name}`);
    setTimeout(() => setSavedMessage(null), 2000);
  };

  return (
    <div
      className="flex flex-col border-t"
      style={{
        borderColor: 'var(--border-color)',
        background: 'var(--bg-secondary)',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          CUSTOM BLOCK EDITOR
        </span>
        <div className="flex gap-1">
          <button
            onClick={handleValidate}
            disabled={isValidating}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium hover:bg-white/10 transition-colors"
            style={{ color: 'var(--accent)' }}
          >
            <Play size={10} />
            {isValidating ? 'Validating...' : 'Validate'}
          </button>
          <button
            onClick={handleSavePreset}
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium hover:bg-white/10 transition-colors"
            style={{ color: 'var(--accent)' }}
            title="Save this custom block to the sidebar"
          >
            <Save size={10} />
            Save Block
          </button>
        </div>
      </div>

      <div className="h-48">
        <Editor
          height="100%"
          language="python"
          theme="vs-dark"
          value={code}
          onChange={handleCodeChange}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 4,
            insertSpaces: true,
            detectIndentation: false,
            renderWhitespace: 'all',
            automaticLayout: true,
            padding: { top: 8 },
          }}
        />
      </div>

      {validationResult && (
        <div
          className="px-3 py-2 text-xs flex items-start gap-2 border-t"
          style={{
            borderColor: 'var(--border-color)',
            color: validationResult.valid ? 'var(--success)' : 'var(--error)',
          }}
        >
          {validationResult.valid ? (
            <>
              <CheckCircle size={14} className="shrink-0 mt-0.5" />
              <span>Block code is valid</span>
            </>
          ) : (
            <>
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <div>
                {validationResult.errors.map((err, i) => (
                  <div key={i}>{err}</div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {savedMessage && (
        <div
          className="px-3 py-2 text-xs flex items-center gap-2 border-t"
          style={{ borderColor: 'var(--border-color)', color: 'var(--success)' }}
        >
          <CheckCircle size={14} />
          <span>{savedMessage}</span>
        </div>
      )}

      {validationResult?.generated_wrapper && (
        <div
          className="border-t"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="px-3 py-2 text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
            GENERATED VALIDATION WRAPPER
          </div>
          <pre
            className="max-h-48 overflow-auto px-3 pb-3 text-xs font-mono leading-relaxed whitespace-pre"
            style={{ color: 'var(--text-primary)' }}
          >
            <code>{validationResult.generated_wrapper}</code>
          </pre>
        </div>
      )}
    </div>
  );
}
