import {
  ArrowDown,
  ArrowUp,
  Braces,
  FileText,
  Plus,
  Trash2,
} from 'lucide-react';
import { PremiumButton } from '../ui/PremiumButton';
import { getTemplateTags } from '../../lib/documents/templateCatalog';
import type {
  DocumentTemplateBlock,
  DocumentTemplateContent,
} from '../../types/documentStudio';

interface DocumentTemplateEditorProps {
  content: DocumentTemplateContent;
  selectedBlockId: string | null;
  onSelectBlock: (blockId: string) => void;
  onChange: (content: DocumentTemplateContent) => void;
}

function normalizeOrder(blocks: DocumentTemplateBlock[]) {
  return blocks.map((block, index) => ({ ...block, order: index }));
}

export function DocumentTemplateEditor({
  content,
  selectedBlockId,
  onSelectBlock,
  onChange,
}: DocumentTemplateEditorProps) {
  const blocks = [...content.blocks].sort((left, right) => left.order - right.order);
  const selected = blocks.find((block) => block.id === selectedBlockId) ?? blocks[0];
  const tags = getTemplateTags(content.documentType);

  const updateBlock = (blockId: string, patch: Partial<DocumentTemplateBlock>) => {
    onChange({
      ...content,
      blocks: content.blocks.map((block) => block.id === blockId ? { ...block, ...patch } : block),
    });
  };

  const moveBlock = (blockId: string, offset: -1 | 1) => {
    const index = blocks.findIndex((block) => block.id === blockId);
    const target = index + offset;
    if (index < 0 || target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...content, blocks: normalizeOrder(next) });
  };

  const addBlock = () => {
    const id = `custom-${crypto.randomUUID()}`;
    const next: DocumentTemplateBlock = {
      id,
      kind: 'article',
      code: `article-personnalise-${blocks.filter((block) => block.custom).length + 1}`,
      title: 'Nouvel article',
      content: 'Rédigez ici la clause propre à votre organisation.',
      enabled: true,
      order: blocks.length,
      custom: true,
    };
    onChange({ ...content, blocks: [...blocks, next] });
    onSelectBlock(id);
  };

  const removeBlock = (blockId: string) => {
    const block = blocks.find((item) => item.id === blockId);
    if (!block || block.locked) return;
    const next = normalizeOrder(blocks.filter((item) => item.id !== blockId));
    onChange({ ...content, blocks: next });
    onSelectBlock(next[0]?.id ?? '');
  };

  const insertTag = (tag: string) => {
    if (!selected || selected.kind === 'system') return;
    const spacer = selected.content && !selected.content.endsWith(' ') ? ' ' : '';
    updateBlock(selected.id, { content: `${selected.content}${spacer}{{${tag}}}` });
  };

  return (
    <div className="grid min-h-0 gap-3 xl:grid-cols-[17rem_minmax(0,1fr)]">
      <aside className="min-h-0 rounded-md border border-emerald-950/10 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
          <div>
            <p className="text-[0.56rem] font-black uppercase tracking-[0.14em] text-orange-600">Structure</p>
            <p className="text-xs font-bold text-slate-900">{blocks.filter((block) => block.enabled).length} sections actives</p>
          </div>
          <PremiumButton variant="secondary" size="sm" icon={<Plus className="h-3.5 w-3.5" />} onClick={addBlock}>
            Article
          </PremiumButton>
        </div>
        <div className="max-h-[18rem] space-y-1 overflow-y-auto p-2 lg:max-h-[38rem]">
          {blocks.map((block, index) => (
            <div
              key={block.id}
              className={`group flex w-full items-center gap-1 rounded-md border p-1 transition ${
                selected?.id === block.id
                  ? 'border-emerald-700/25 bg-emerald-50 text-emerald-950'
                  : 'border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50'
              }`}
            >
              <button
                type="button"
                onClick={() => onSelectBlock(block.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1 py-0.5 text-left"
              >
                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-300" />
                <span className="min-w-0 flex-1 truncate text-[0.68rem] font-bold">{block.title}</span>
                {!block.enabled && <span className="text-[0.5rem] font-black uppercase text-slate-400">masqué</span>}
              </button>
              <button
                type="button"
                aria-label="Monter la section"
                onClick={() => moveBlock(block.id, -1)}
                disabled={index === 0}
                className={`rounded p-0.5 hover:bg-white ${index === 0 ? 'pointer-events-none opacity-20' : 'opacity-50 group-hover:opacity-100'}`}
              >
                <ArrowUp className="h-3 w-3" />
              </button>
              <button
                type="button"
                aria-label="Descendre la section"
                onClick={() => moveBlock(block.id, 1)}
                disabled={index === blocks.length - 1}
                className={`rounded p-0.5 hover:bg-white ${index === blocks.length - 1 ? 'pointer-events-none opacity-20' : 'opacity-50 group-hover:opacity-100'}`}
              >
                <ArrowDown className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      {selected && (
        <section className="min-w-0 rounded-md border border-emerald-950/10 bg-white p-3">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-200 pb-2">
            <div>
              <p className="text-[0.56rem] font-black uppercase tracking-[0.14em] text-orange-600">
                {selected.custom ? 'Clause personnalisée' : 'Modèle officiel'}
              </p>
              <p className="text-sm font-black text-slate-950">{selected.title}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1.5 text-[0.64rem] font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={selected.enabled}
                  disabled={selected.required}
                  onChange={(event) => updateBlock(selected.id, { enabled: event.target.checked })}
                  className="h-3.5 w-3.5 accent-emerald-800"
                />
                Active
              </label>
              {!selected.locked && (
                <button
                  type="button"
                  onClick={() => removeBlock(selected.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-red-200 text-red-600 hover:bg-red-50"
                  aria-label="Supprimer la section"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem]">
            <label className="block">
              <span className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-500">Titre</span>
              <input
                value={selected.title}
                onChange={(event) => updateBlock(selected.id, { title: event.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
              />
            </label>
            <label className="block">
              <span className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-500">Code interne</span>
              <input
                value={selected.code}
                disabled={!selected.custom}
                onChange={(event) => updateBlock(selected.id, { code: event.target.value.replace(/[^a-z0-9-]/gi, '-').toLowerCase() })}
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold outline-none disabled:text-slate-400"
              />
            </label>
          </div>

          {selected.kind !== 'system' && (
            <label className="mt-3 block">
              <span className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-500">Contenu</span>
              <textarea
                value={selected.content}
                onChange={(event) => updateBlock(selected.id, { content: event.target.value })}
                rows={12}
                className="mt-1 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
              />
            </label>
          )}

          {selected.kind === 'system' ? (
            <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[0.66rem] leading-relaxed text-blue-800">
              Cette section est alimentée par la source métier. Vous pouvez la déplacer ou la masquer, sans altérer les calculs.
            </div>
          ) : (
            <div className="mt-3">
              <div className="flex items-center gap-1.5">
                <Braces className="h-3.5 w-3.5 text-emerald-700" />
                <p className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-500">Variables disponibles</p>
              </div>
              <div className="mt-1.5 flex max-h-24 flex-wrap gap-1 overflow-y-auto">
                {tags.map((tag) => (
                  <button
                    type="button"
                    key={tag.key}
                    title={`${tag.label} · Exemple : ${tag.example}`}
                    onClick={() => insertTag(tag.key)}
                    className="rounded border border-emerald-900/10 bg-emerald-50 px-1.5 py-1 text-[0.58rem] font-bold text-emerald-800 hover:border-emerald-700/30 hover:bg-emerald-100"
                  >
                    {tag.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
