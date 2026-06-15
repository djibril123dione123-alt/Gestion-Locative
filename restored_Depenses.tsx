<line_number>: <original_line>. Please note that any changes targeting the original code should remove the line number, colon, and leading space.

> samay-keur-gestion-locative@0.0.0 typecheck
> tsc --noEmit -p tsconfig.app.json

src/pages/LoyersImpayes.tsx(83,31): error TS6133: 'embedded' is declared but its value is never read.
src/pages/Paiements.tsx(74,27): error TS6133: 'embedded' is declared but its value is never read.

> samay-keur-gestion-locative@0.0.0 lint
> eslint .


C:\Users\DELL\Documents\Samay Keur\App Samay Keur\src\pages\Depenses.tsx
  77:9  warning  The 'categories' array makes the dependencies of useMemo Hook (at line 99) change on every render. To fix this, wrap the initialization of 'categories' in its own useMemo() Hook  react-hooks/exhaustive-deps

C:\Users\DELL\Documents\Samay Keur\App Samay Keur\src\pages\LoyersImpayes.tsx
  83:33  error  'embedded' is defined but never used  @typescript-eslint/no-unused-vars

C:\Users\DELL\Documents\Samay Keur\App Samay Keur\src\pages\Paiements.tsx
  74:29  error  'embedded' is defined but never used  @typescript-eslint/no-unused-vars

✖ 3 problems (2 errors, 1 warning)


> samay-keur-gestion-locative@0.0.0 build
> vite build

vite v5.4.21 building for production...
transforming...
✓ 3579 modules transformed.
rendering chunks...
computing gzip size...
dist/index.html                                           1.19 kB │ gzip:   0.59 kB
dist/assets/index-CE5OjDqR.css                          224.58 kB │ gzip:  31.69 kB
dist/assets/cfaSettlement-VMq_cWMi.js           
<truncated 6137 bytes>
 kB │ gzip:   6.25 kB
dist/assets/Pricing-BcNnE19F.js                          21.52 kB │ gzip:   7.24 kB
dist/assets/Equipe-C7bgIanA.js                           21.82 kB │ gzip:   6.28 kB
dist/assets/LoyersImpayes-cKFyUXkp.js                    21.98 kB │ gzip:   7.03 kB
dist/assets/purify.es-BwoZCkIS.js                        22.03 kB │ gzip:   8.77 kB
dist/assets/Contrats-ATjLE3Wq.js                         25.83 kB │ gzip:   6.61 kB
dist/assets/Documents-DjevHqiL.js                        28.76 kB │ gzip:   8.22 kB
dist/assets/Parametres-RpnLnBtW.js                       29.62 kB │ gzip:   8.02 kB
dist/assets/Commissions-DUxBv8t8.js                      37.44 kB │ gzip:  10.48 kB
dist/assets/Paiements-QTul5KYD.js                        41.49 kB │ gzip:  12.42 kB
dist/assets/TableauDeBordFinancierGlobal-CSwlSJmc.js     56.76 kB │ gzip:  18.17 kB
dist/assets/Patrimoine-DmWrQLC5.js                       62.22 kB │ gzip:  15.47 kB
dist/assets/Bailleurs-BnkGnqWa.js                        66.87 kB │ gzip:  18.24 kB
dist/assets/OccupantsBaux-CY_z_18D.js                    74.56 kB │ gzip:  18.68 kB
dist/assets/Console-BNrZ7jBM.js                         100.01 kB │ gzip:  24.11 kB
dist/assets/Dashboard-CQQMiuVp.js                       102.19 kB │ gzip:  26.35 kB
dist/assets/index.es-D0JrQCoa.js                        150.76 kB │ gzip:  51.59 kB
dist/assets/html2canvas.esm-CBrSDip1.js                 201.42 kB │ gzip:  48.03 kB
dist/assets/useExport-DzI73SuN.js                       286.57 kB │ gzip:  96.48 kB
dist/assets/BarChart-C0vb6IFX.js                        374.87 kB │ gzip: 103.75 kB
dist/assets/pdf-B-WEf8iC.js                             458.74 kB │ gzip: 151.99 kB
dist/assets/index-D3jb-n93.js                           763.34 kB │ gzip: 223.60 kB
✓ built in 20.09s

