// One build, two files: dist/sst-chat.js (IIFE, the <script> tag — window.SSTChat) and
// dist/sst-chat.mjs (ES module, for bundlers). Preact and the CSS are bundled into both; the CSS
// is imported as a string (?inline) and goes into the widget's shadow root, never the page.
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
    plugins: [tailwindcss()],
    oxc: { jsx: { runtime: 'automatic', importSource: 'preact' } },
    build: {
        target: 'es2020',
        lib: {
            entry: 'src/index.jsx',
            name: 'SSTChat',
            formats: ['iife', 'es'],
            fileName: (format) => (format === 'es' ? 'sst-chat.mjs' : 'sst-chat.js'),
        },
    },
});
