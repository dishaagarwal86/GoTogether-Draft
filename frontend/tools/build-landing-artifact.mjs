import { build } from 'vite'
import react from '@vitejs/plugin-react'
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontend = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const artifacts = resolve(frontend, '../artifacts')
const temporaryBuild = resolve(artifacts, '.landing-build')
await mkdir(artifacts, { recursive: true })
await build({
  configFile: false,
  root: frontend,
  plugins: [react()],
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  build: {
    outDir: temporaryBuild,
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: { entry: resolve(frontend, 'src/landing-artifact.tsx'), name: 'GoTogetherLanding', formats: ['iife'], fileName: () => 'landing.js' },
  },
})
const files = await readdir(temporaryBuild)
const cssFile = files.find((file) => file.endsWith('.css'))
const bundledCss = await readFile(resolve(temporaryBuild, cssFile), 'utf8')
const fontCss = await readFile(resolve(frontend, 'src/assets/landing/fonts.css'), 'utf8')
const css = fontCss + bundledCss.replace(/@import\s*(?:url\([^)]*\)|"[^"]*"|'[^']*')\s*;/g, '')
const script = await readFile(resolve(temporaryBuild, 'landing.js'), 'utf8')
const html = `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="theme-color" content="#263e36"><meta name="description" content="A GoTogether landing-page concept: discover destinations, explore shared Travel DNA, and plan a trip with your people."><title>Go.Together — The world feels better shared</title>
<style>html{scroll-behavior:smooth}body{margin:0;min-width:320px}button,input,select{font:inherit}@media(prefers-reduced-motion:reduce){html{scroll-behavior:auto}}${css}</style>
</head><body><div id="root"></div><script>${script.replaceAll('</script', '<\\/script')}</script></body></html>`
await writeFile(resolve(artifacts, 'gotogether-landing.html'), html)
await rm(temporaryBuild, { recursive: true, force: true })
console.log(`Standalone artifact: ${resolve(artifacts, 'gotogether-landing.html')} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MB)`)
