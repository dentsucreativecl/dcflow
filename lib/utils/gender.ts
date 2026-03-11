/**
 * Adapts a job title (cargo) to a grammatical gender.
 * gender: 'MASCULINE' | 'FEMININE' | 'NEUTRAL'
 */
export function getGendered(cargo: string, gender?: string): string {
    if (!cargo || !gender || gender === 'MASCULINE') return cargo;

    if (gender === 'FEMININE') {
        return cargo
            // "Director" → "Directora", "Supervisor" → "Supervisora"
            .replace(/\bDirector\b/g, 'Directora')
            .replace(/\bSupervisor\b/g, 'Supervisora')
            .replace(/\bGerente General\b/g, 'Gerente General')
            // "Ejecutivo" → "Ejecutiva", "Creativo" → "Creativa"
            .replace(/(\w+)ivo\b/g, (_, stem) => `${stem}iva`)
            // "Redactor" → "Redactora", "Productor" → "Productora"
            .replace(/(\w+)or\b/g, (_, stem) => `${stem}ora`)
            // "Diseñado" → "Diseñada", "Asignado" → "Asignada"
            .replace(/(\w+)ado\b/g, (_, stem) => `${stem}ada`)
            // "Estratega", "Artista", "Especialista" already neutral
            ;
    }

    if (gender === 'NEUTRAL') {
        return cargo
            .replace(/\bDirector(a)?\b/g, 'Directore')
            .replace(/\bSupervisor(a)?\b/g, 'Supervisore')
            .replace(/(\w+)ivo\b/g, (_, stem) => `${stem}ive`)
            .replace(/(\w+)or\b/g, (_, stem) => `${stem}ore`)
            .replace(/(\w+)ado\b/g, (_, stem) => `${stem}ade`)
            ;
    }

    return cargo;
}
