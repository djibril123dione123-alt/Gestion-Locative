import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const preserveGeneratedNodeSource = () => ({
  postcssPlugin: 'samay-keur-preserve-generated-node-source',
  Once(root, { result }) {
    // Vite's CSS URL rewriter expects generated nodes to keep a source file.
    // Tailwind can emit source-less rules, which produced noisy PostCSS warnings.
    const fallbackSource = root.source ?? (result.opts.from ? { input: { file: result.opts.from } } : undefined);
    if (!fallbackSource) return;

    root.walk((node) => {
      if (!node.source) {
        node.source = fallbackSource;
      }
    });
  },
});

preserveGeneratedNodeSource.postcss = true;

export default {
  plugins: [
    tailwindcss(),
    autoprefixer(),
    preserveGeneratedNodeSource(),
  ],
};
