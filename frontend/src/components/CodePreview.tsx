import { useRef } from 'react';
import { useGraphStore } from '../store/graphStore';
import { Copy, Check, Download } from 'lucide-react';
import { useState } from 'react';

export default function CodePreview() {
  const generatedCode = useGraphStore(s => s.generatedCode);
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([generatedCode], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'model.py';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="h-full flex flex-col"
      style={{
        background: 'var(--bg-secondary)',
        borderTop: '1px solid var(--border-color)',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          GENERATED CODE
        </span>
        <div className="flex gap-1">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="Copy to clipboard"
          >
            {copied ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
          </button>
          <button
            onClick={handleDownload}
            className="p-1 rounded hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-muted)' }}
            title="Download as model.py"
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      <pre
        ref={codeRef}
        className="flex-1 overflow-auto p-3 text-xs font-mono leading-relaxed"
        style={{ color: 'var(--text-primary)' }}
      >
        <code>{generatedCode || '# Add blocks to the canvas to generate code'}</code>
      </pre>
    </div>
  );
}
