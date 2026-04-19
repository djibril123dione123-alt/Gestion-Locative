/**
 * Global type augmentation for jspdf-autotable.
 * TypeScript picks this up automatically since src/ is included.
 * Do NOT redeclare this in individual pages.
 */
declare module 'jspdf' {
  interface jsPDF {
    autoTable(options: import('jspdf-autotable').UserOptions): jsPDF;
    lastAutoTable: { finalY: number };
  }
}
