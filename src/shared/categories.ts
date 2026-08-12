import type { JobCategory } from './types'

export function buildCategoryText(category: JobCategory, positionName: string): string {
  const name = positionName.trim() || category.name
  return [
    `## ${name}`,
    '',
    `Categoría: ${category.areaId}`,
    '',
    '## Sobre el puesto',
    '',
    category.description || category.name,
    '',
    '## Responsabilidades principales',
    '',
    '- Ejecutar las funciones propias del rol de forma profesional y orientada a resultados.',
    '- Colaborar con el equipo y aportar experiencia en el área.',
    '- Aplicar buenas prácticas y estándares de la industria en el día a día.',
    '',
    '## Requisitos y competencias deseadas',
    '',
    ...category.keywords.map((kw) => `- ${kw}`),
    '',
    '## Habilidades valoradas',
    '',
    'Trabajo en equipo, comunicación efectiva, orientación al detalle y aprendizaje continuo.',
  ].join('\n')
}
