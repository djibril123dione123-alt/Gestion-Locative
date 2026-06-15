<line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.
import React from 'react';
import { BrandMark } from '../brand/BrandLogo';
import { formatSenegalPhone, getSenegalPhoneHref } from '../../lib/formatters';

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
  const getCellValue = (item: T, key: string): React.ReactNode => {
    const value = (item as Record<string, unknown>)[key];
    if (value === null || value === undefined || value === '') return null;
    if (React.isValidElement(value)) return value;
    if (['string', 'number', 'boolean'].includes(typeof value)) return String(value);
    return JSON.stringify(value);
  };

  const renderContactValue = (key: string, value: React.ReactNode) => {
    if (value === null || value === undefined || value === '' || React.isValidElement(value)) return value;
    const text = String(value).trim();
    const normalizedKey = key.toLowerCase();

    if ((normalizedKey.includes('email') || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) && text.includes('@')) {
      const to = encodeURIComponent(text);
      return (
        <a
          href={`https://mail.google.com/mail/?view=cm&fs=1&to=$
<truncated 5307 bytes>
h>
                )}
              </tr>
            </thead>

            <tbody>
              {data.map((item) => (
                <tr key={item.id} className="border-b border-slate-100 transition hover:bg-emerald-50/55">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-3.5 text-sm font-medium text-slate-700 xl:px-5 xl:py-4">
                      {renderContactValue(column.key, column.render ? column.render(item) : getCellValue(item, column.key))}
                    </td>
                  ))}

                  {(onEdit || onDelete) && (
                    <td className="px-4 py-3.5 text-right xl:px-5 xl:py-4">
                      <div className="sk-action-group-right">
                        {onEdit && (
                          <button
                            type="button"
                            onClick={() => onEdit(item)}
                            className="sk-action sk-action-secondary"
                          >
                            Modifier
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            onClick={() => onDelete(item)}
                            className="sk-action sk-action-danger"
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
      </div>
    </>
  );
}

