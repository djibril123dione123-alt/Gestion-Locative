import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Braces,
  FileText,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { PremiumButton } from '../ui/PremiumButton';
import {
  getSystemBlockPublicLabel,
  getTemplateTags,
  TEMPLATE_TAG_CATEGORY_LABELS,
} from '../../lib/documents/templateCatalog';
import type {
  DocumentTemplateBlock,
  DocumentTemplateContent,
  TemplateTagDefinition,
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

function groupTags(tags: TemplateTagDefinition[]) {
  return tags.reduce<Record<TemplateTagDefinition['category'], TemplateTagDefinition[]>>((groups, tag) => {
    groups[tag.category] = [...(groups[tag.category] ?? []), tag];
    return groups;
  }, {} as Record<TemplateTagDefinition['category'], TemplateTagDefinition[]>);
}

export function DocumentTemplateEditor({
  content,
  selectedBlockId,
  onSelectBlock,
  onChange,
}: DocumentTemplateEditorProps) {
  const [tagSearch, setTagSearch] = useState('');
  const blocks = [...content.blocks].sort((left, right) => left.order - right.order);
  const selected = blocks.find((block) => block.id === selectedBlockId) ?? blocks[0];
  const tags = getTemplateTags(content.documentType);
  const filteredTags = useMemo(() => {
    const query = tagSearch.trim().toLowerCase();
    if (!query) return tags;
    return tags.filter((tag) => (
      tag.label.toLowerCase().includes(query)
      || tag.key.toLowerCase().includes(query)
      || tag.example.toLowerCase().includes(query)
    ));
  }, [tagSearch, tags]);
  const groupedTags = useMemo(() => groupTags(filteredTags), [filteredTags]);

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
                <span className="min-w-0 flex-1 truncate text-[0.68rem] font-bold">
                  {block.kind === 'system' ? getSystemBlockPublicLabel(block.systemKey, block.title) : block.title}
                </span>
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
                {selected.custom ? 'Clause personnalisée' : selected.kind === 'system' ? 'Section automatique' : 'Modèle officiel'}
              </p>
              <p className="text-sm font-black text-slate-950">
                {selected.kind === 'system' ? getSystemBlockPublicLabel(selected.systemKey, selected.title) : selected.title}
              </p>
              {!selected.custom && selected.kind !== 'system' && (
                <p className="mt-0.5 text-[0.58rem] font-semibold text-slate-400">Identifiant modèle : {selected.code}</p>
              )}
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

          <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
            <label className="block">
              <span className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-500">Titre public</span>
              <input
                value={selected.title}
                onChange={(event) => updateBlock(selected.id, { title: event.target.value })}
                className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs font-semibold outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
              />
            </label>
            {selected.custom ? (
              <label className="block">
                <span className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-500">Identifiant</span>
                <input
                  value={selected.code}
                  onChange={(event) => updateBlock(selected.id, { code: event.target.value.replace(/[^a-z0-9-]/gi, '-').toLowerCase() })}
                  className="mt-1 h-9 w-full rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold outline-none"
                />
                <span className="mt-1 block text-[0.54rem] font-semibold text-slate-400">Invisible sur le PDF.</span>
              </label>
            ) : (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">
                <p className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-500">Source</p>
                <p className="mt-1 text-xs font-bold text-slate-700">
                  {selected.kind === 'system' ? 'Données métier validées' : 'Catalogue officiel'}
                </p>
              </div>
            )}
          </div>

          {selected.kind !== 'system' && (
            <label className="mt-3 block">
              <span className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-500">Contenu</span>
              <textarea
                value={selected.content}
                onChange={(event) => updateBlock(selected.id, { content: event.target.value })}
                rows={10}
                spellCheck={false}
                className="mt-1 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-xs leading-relaxed outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
              />
            </label>
          )}

          {selected.kind === 'system' ? (
            <div className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[0.66rem] leading-relaxed text-blue-800">
              Cette section est alimentée par la source métier. Vous pouvez la déplacer ou la masquer, sans altérer les calculs ni les données financières.
            </div>
          ) : (
            <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <Braces className="h-3.5 w-3.5 text-emerald-700" />
                  <div>
                    <p className="text-[0.58rem] font-black uppercase tracking-[0.12em] text-slate-500">Variables disponibles</p>
                    <p className="text-[0.58rem] font-semibold text-slate-500">Cliquez pour insérer une donnée remplacée automatiquement au PDF.</p>
                  </div>
                </div>
                <label className="relative block w-full sm:w-52">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    value={tagSearch}
                    onChange={(event) => setTagSearch(event.target.value)}
                    placeholder="Rechercher..."
                    className="h-8 w-full rounded-md border border-slate-200 bg-white pl-7 pr-2 text-[0.66rem] font-semibold outline-none focus:border-emerald-700"
                  />
                </label>
              </div>
              <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
                {Object.entries(TEMPLATE_TAG_CATEGORY_LABELS).map(([category, label]) => {
                  const categoryTags = groupedTags[category as TemplateTagDefinition['category']] ?? [];
                  if (categoryTags.length === 0) return null;
                  return (
                    <div key={category}>
                      <p className="mb-1 text-[0.54rem] font-black uppercase tracking-[0.12em] text-slate-400">{label}</p>
                      <div className="flex flex-wrap gap-1">
                        {categoryTags.map((tag) => (
                          <button
                            type="button"
                            key={tag.key}
                            title={`${tag.label} · Exemple : ${tag.example}`}
                            onClick={() => insertTag(tag.key)}
                            className="rounded border border-emerald-900/10 bg-white px-1.5 py-1 text-left text-[0.58rem] font-bold text-emerald-800 hover:border-emerald-700/30 hover:bg-emerald-50"
                          >
                            <span>{tag.label}</span>
                            <span className="ml-1 text-slate-400">{`{{${tag.key}}}`}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
