export const AREAS = [
    'Diseño',
    'Social Media',
    'Creatividad',
    'Producción',
    'Estrategia',
    'Cuentas',
] as const;

export type Area = typeof AREAS[number];
