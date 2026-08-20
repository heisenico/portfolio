import { describe, expect, it } from 'vitest'
import { buildPath, matchRoute, stripBase } from '../routes'

describe('stripBase', () => {
  it('removes a subdirectory base', () => {
    expect(stripBase('/portfolio/blog', '/portfolio/')).toBe('/blog')
  })

  it('returns root when the path is exactly the base', () => {
    expect(stripBase('/portfolio/', '/portfolio/')).toBe('/')
    expect(stripBase('/portfolio', '/portfolio/')).toBe('/')
  })

  it('is a no-op for a root base', () => {
    expect(stripBase('/blog/foo', '/')).toBe('/blog/foo')
  })

  it('leaves a path outside the base alone', () => {
    expect(stripBase('/outro/x', '/portfolio/')).toBe('/outro/x')
  })

  it('always returns a leading slash', () => {
    expect(stripBase('portfolio/blog', '/portfolio/').startsWith('/')).toBe(true)
  })
})

describe('matchRoute', () => {
  it('matches home', () => {
    expect(matchRoute('/')).toMatchObject({ name: 'home' })
  })

  it('matches the blog with and without a trailing slash', () => {
    expect(matchRoute('/blog')).toMatchObject({ name: 'blog' })
    expect(matchRoute('/blog/')).toMatchObject({ name: 'blog' })
  })

  it('matches a post and extracts its slug', () => {
    expect(matchRoute('/blog/ola-mundo')).toMatchObject({
      name: 'post',
      params: { slug: 'ola-mundo' },
    })
    expect(matchRoute('/blog/ola-mundo/')).toMatchObject({
      name: 'post',
      params: { slug: 'ola-mundo' },
    })
  })

  it('does not treat a deeper path as a post', () => {
    expect(matchRoute('/blog/a/b')).toMatchObject({ name: 'notFound' })
  })

  it('decodes an encoded slug', () => {
    expect(matchRoute('/blog/ol%C3%A1')).toMatchObject({ params: { slug: 'olá' } })
  })

  it('falls through to notFound', () => {
    expect(matchRoute('/quem-sabe')).toMatchObject({ name: 'notFound' })
  })
})

describe('buildPath', () => {
  it('round-trips with matchRoute', () => {
    expect(matchRoute(buildPath('home'))).toMatchObject({ name: 'home' })
    expect(matchRoute(buildPath('blog'))).toMatchObject({ name: 'blog' })
    expect(matchRoute(buildPath('post', { slug: 'x' }))).toMatchObject({
      name: 'post',
      params: { slug: 'x' },
    })
  })

  it('encodes a slug that needs it', () => {
    expect(buildPath('post', { slug: 'olá' })).toBe('/blog/ol%C3%A1')
  })
})
