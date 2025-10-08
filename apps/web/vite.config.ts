import { defineConfig } from 'vite'
import fs from 'fs'
import path from 'path'

const certDir = path.resolve(__dirname, '../../certs')
const keyPath = path.join(certDir, 'localhost-key.pem')
const certPath = path.join(certDir, 'localhost-cert.pem')

const useHttps =
  fs.existsSync(keyPath) && fs.existsSync(certPath)
    ? {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath),
      }
    : false

export default defineConfig({
  server: {
    port: 3000,
    https: useHttps,
  },
})