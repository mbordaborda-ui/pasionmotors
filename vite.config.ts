import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  if (!env.VITE_SUPABASE_URL || !env.VITE_SUPABASE_ANON_KEY) {
    console.warn(
      '\n[PASION MOTORS] Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en este build. ' +
        'Configúralas en Netlify → Site configuration → Environment variables.\n',
    )
  }

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      rollupOptions: {
        output: {
          // Separa las dependencias que casi nunca cambian: el navegador las
          // reutiliza entre despliegues y el HTML nuevo solo baja el código app.
          manualChunks: {
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
            'supabase-vendor': ['@supabase/supabase-js'],
          },
        },
      },
    },
  }
})
