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
  return (
    <div className="overflow-x-auto shadow-md rounded-xl border border-gray-100 bg-white">
      <table className="w-full border-collapse">
        {/* --- En-têtes --- */}
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

        {/* --- Corps du tableau --- */}
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + 1}
                className="text-center py-10 text-slate-500"
              >
                Aucune donnée disponible
              </td>
            </tr>
          ) : (
            data.map((item) => (
              <tr
                key={item.id}
                className="border-b border-slate-100 hover:bg-gradient-to-r hover:from-[#FFF7F0] hover:to-[#FFEFEA] transition"
              >
                {columns.map((column) => (
                  <td key={column.key} className="py-4 px-5 text-sm text-slate-700">
                    {column.render ? column.render(item) : (item as any)[column.key]}
                  </td>
                ))}

                {/* --- Boutons Actions --- */}
                {(onEdit || onDelete) && (
                  <td className="py-4 px-5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {onEdit && (
                        <button
                          onClick={() => onEdit(item)}
                          className="px-3 py-1.5 text-sm font-medium text-white rounded-lg shadow-sm transition-transform hover:scale-105"
                          style={{
                            background:
                              'linear-gradient(135deg, #F58220 0%, #FF914D 100%)',
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
                            background:
                              'linear-gradient(135deg, #C0392B 0%, #E74C3C 100%)',
                          }}
                        >
                          Supprimer
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
