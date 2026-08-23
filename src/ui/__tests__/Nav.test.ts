import { describe, expect, it } from 'vitest'
import { activeIndex } from '../Nav'

describe('activeIndex', () => {
  it('acende o segmento início na home', () => {
    expect(activeIndex('home')).toBe(0)
  })

  it('acende o segmento blog em /blog', () => {
    expect(activeIndex('blog')).toBe(1)
  })

  it('um post ainda acende blog, porque é dentro dele que ele vive', () => {
    expect(activeIndex('post')).toBe(1)
  })

  it('não reivindica nenhum segmento numa rota que não existe', () => {
    expect(activeIndex('notFound')).toBeNull()
  })
})
