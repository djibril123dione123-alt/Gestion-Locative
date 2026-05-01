import React from 'react';

interface Column<T> {
  key: string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
}

export function Table<T extends { id: string }>({
  columns,
  data,
  onEdit,
  onDelete,
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="text-center py-10 text-slate-500 bg-white rounded-xl border border-gray-100 shadow-sm">
        Aucune donnée disponible
      </div>
    );
  }

  return (
    <>
      {/* Mobile: card view */}
      <div className="sm:hidden space-y-3">
        {data.map((item) => (
          <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="divide-y divide-slate-50">
              {columns.map((col) => {
                const value = col.render ? col.render(item) : (item as any)[col.key];
                if (value === null || value === undefined || value === '') return null;
                return (
                  <div key={col.key} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide flex-shrink-0 w-24">
                      {col.label}
                    </span>
                    <span className="text-sm text-slate-800 text-right min-w-0 flex-1 truncate">
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
            {(onEdit || onDelete) && (
              <div className="flex gap-2 px-4 py-3 bg-slate-50 border-t border-slate-100">
                {onEdit && (
                  <button
                    onClick={() => onEdit(item)}
                    className="flex-1 py-2 text-sm font-medium text-white rounded-lg"
                    style={{ background: 'linear-gradient(135deg, #F58220 0%, #FF914D 100%)' }}
                  >
                    Modifier
                  </button>
                )}
                {onDelete && (
                  <button
                    onClick={() => onDelete(item)}
                    className="flex-1 py-2 text-sm font-medium text-white rounded-lg"
                    style={{ background: 'linear-gradient(135deg, #C0392B 0%, #E74C3C 100%)' }}
                  >
                    Supprimer
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: table view */}
      <div className="hidden sm:block overflow-x-auto shadow-md rounded-xl border border-gray-100 bg-white">
        <table className="w-full border-collapse">
          <thead
            className="bg-gradient-to-r from-[#F58220]/10 to-[#C0392B]/10 border-b"
            style={{ borderBottomColor: '#F58220' }}
          >
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="text-left py-4 px-5 text-sm font-semibold text-[#3A3A3A] uppercase tracking-wide"
                >
                  {column.label}
                </th>
              ))}
              {(onEdit || onDelete) && (
                <th className="text-right py-4 px-5 text-sm font-semibold text-[#3A3A3A] uppercase tracking-wide">
                  Actions
                </th>
              )}
            </tr>
          </thead>

          <tbody>
            {data.map((item) => (
              <tr
                key={item.id}
                className="border-b border-slate-100 hover:bg-gradient-to-r hover:from-[#FFF7F0] hover:to-[#FFEFEA] transition"
              >
                {columns.map((column) => (
                  <td key={column.key} className="py-4 px-5 text-sm text-slate-700">
                    {column.render ? column.render(item) : (item as any)[column.key]}
                  </td>
                ))}

                {(onEdit || onDelete) && (
                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(item)}
                          className="px-3 py-1.5 text-sm font-medium text-white rounded-lg shadow-sm transition-transform hover:scale-105"
                          style={{
                            background: 'linear-gradient(135deg, #F58220 0%, #FF914D 100%)',
                          }}
                        >
                          Modifier
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={() => onDelete(item)}
                          className="px-3 py-1.5 text-sm font-medium text-white rounded-lg shadow-sm transition-transform hover:scale-105"
                          style={{
                            background: 'linear-gradient(135deg, #C0392B 0%, #E74C3C 100%)',
                          }}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
