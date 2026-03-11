/**
 * Seed User profiles (department, userAreas) from Excel.
 * Reads "Equipo y Cuentas" sheet and updates each User by email.
 *
 * Usage: npx tsx scripts/seed-user-profiles.ts
 */
import { createClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import 'dotenv/config'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface ExcelRow {
  'Asignación de Equipo a Cuentas': string // Nombre
  '__EMPTY'?: string   // Email
  '__EMPTY_1'?: string // Cliente Asignado
  '__EMPTY_2'?: string // Rol en la Cuenta
  '__EMPTY_3'?: string // Área/Departamento
}

async function main() {
  const wb = XLSX.readFile('/workspaces/dcflow/DC-Flow-Setup-v4.xlsx')
  const sheetName = wb.SheetNames.find(n => n.includes('Equipo'))
  if (!sheetName) {
    console.error('Sheet "Equipo" not found. Available:', wb.SheetNames)
    process.exit(1)
  }

  const rows = XLSX.utils.sheet_to_json<ExcelRow>(wb.Sheets[sheetName])

  // Skip header rows (first 2 rows are description + column headers)
  const dataRows = rows.filter(r => {
    const email = r.__EMPTY
    return email && email.includes('@')
  })

  console.log(`📋 Found ${dataRows.length} rows with emails`)

  // Group by email — take first occurrence for role, collect all areas
  const profileMap = new Map<string, { department: string; areas: Set<string> }>()

  for (const row of dataRows) {
    const email = (row.__EMPTY || '').trim().toLowerCase()
    if (!email) continue

    const role = (row.__EMPTY_2 || '').trim()
    const area = (row.__EMPTY_3 || '').trim()

    if (!profileMap.has(email)) {
      profileMap.set(email, { department: role, areas: new Set() })
    }

    if (area) {
      profileMap.get(email)!.areas.add(area)
    }
  }

  console.log(`👤 Unique users to update: ${profileMap.size}`)
  console.log('')

  let updated = 0
  let notFound = 0

  for (const [email, profile] of profileMap) {
    const userAreas = Array.from(profile.areas)

    const { data, error } = await admin
      .from('User')
      .update({
        department: profile.department || null,
        userAreas: userAreas,
      })
      .eq('email', email)
      .select('id, name, email')

    if (error) {
      console.error(`  ❌ ${email}: ${error.message}`)
    } else if (!data || data.length === 0) {
      console.log(`  ⚠️  ${email}: not found in DB`)
      notFound++
    } else {
      console.log(`  ✅ ${data[0].name}: department="${profile.department}", areas=[${userAreas.join(', ')}]`)
      updated++
    }
  }

  console.log('')
  console.log(`Done: ${updated} updated, ${notFound} not found`)
}

main().catch(console.error)
