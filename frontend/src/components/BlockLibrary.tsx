import { useState, type DragEvent } from 'react';
import { Search, ChevronDown, ChevronRight } from 'lucide-react';
import { CATEGORIES, getBlocksByCategory } from '../blocks/registry';
import type { BlockDefinition } from '../blocks/types';

export default function BlockLibrary() {
  const [search, setSearch] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(CATEGORIES.map(c => c.key))
  );

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const onDragStart = (e: DragEvent, blockType: string) => {
    e.dataTransfer.setData('application/nodalab-block', blockType);
    e.dataTransfer.effectAllowed = 'move';
  };

  const filteredCategories = CATEGORIES.map(cat => ({
    ...cat,
    blocks: getBlocksByCategory(cat.key).filter(b =>
      b.type.toLowerCase().includes(search.toLowerCase()) ||
      b.description.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.blocks.length > 0);

  return (
    <div className="w-56 h-full flex flex-col" style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)' }}>
      <div className="p-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <div className="text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
          BLOCKS
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search blocks..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 rounded text-xs outline-none"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-primary)',
            }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {filteredCategories.map(cat => (
          <div key={cat.key} className="mb-2">
            <button
              onClick={() => toggleCategory(cat.key)}
              className="flex items-center w-full text-xs font-semibold py-1 px-1 rounded hover:bg-white/5"
              style={{ color: 'var(--text-secondary)' }}
            >
              {expandedCategories.has(cat.key)
                ? <ChevronDown size={12} className="mr-1" />
                : <ChevronRight size={12} className="mr-1" />
              }
              {cat.label}
              <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>
                {cat.blocks.length}
              </span>
            </button>

            {expandedCategories.has(cat.key) && (
              <div className="ml-1 mt-1 space-y-0.5">
                {cat.blocks.map((block: BlockDefinition) => (
                  <div
                    key={block.type}
                    draggable
                    onDragStart={e => onDragStart(e, block.type)}
                    className="px-2 py-1.5 rounded text-xs cursor-grab active:cursor-grabbing hover:bg-white/5 transition-colors"
                    style={{ color: 'var(--text-primary)' }}
                    title={block.description}
                  >
                    <div className="font-medium">{block.type}</div>
                    <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
                      {block.description}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
