import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  preview: {
    allowedHosts: true,
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/widget.js'),
      name: 'VoiceIQWidget',
      formats: ['iife'],
      fileName: () => 'voiceiq-widget.js',
    },
    outDir: 'dist',
    emptyOutDir: true,
  },
});
