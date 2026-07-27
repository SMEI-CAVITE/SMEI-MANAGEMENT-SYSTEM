import React from 'react';

export function TableSkeleton({ rows = 5, columns = 6 }: { rows?: number, columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <tr key={rowIndex} className="animate-pulse border-b border-gray-100 dark:border-neutral-800">
          {Array.from({ length: columns }).map((_, colIndex) => (
            <td key={colIndex} className="py-4 px-6">
              <div className="h-4 bg-gray-200 dark:bg-neutral-800 rounded w-3/4"></div>
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
