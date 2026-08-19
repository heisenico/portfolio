/**
 * The cat's surface.
 *
 * A fresnel shell rather than a lit material: the world has no lights, and a
 * conventionally shaded animal would look imported from a different scene. The
 * rim brightens where the surface turns away from the viewer, which reads as a
 * scanned volume and matches the wireframe tree.
 */

export const catVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;
varying float vHeight;

#include <fog_pars_vertex>

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - worldPosition.xyz);
  vHeight = position.y;

  vec4 mvPosition = viewMatrix * worldPosition;
  gl_Position = projectionMatrix * mvPosition;

  #include <fog_vertex>
}
`

export const catFragment = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uRim;
uniform float uOpacity;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vView;
varying float vHeight;

#include <fog_pars_fragment>

void main() {
  float facing = abs(dot(normalize(vNormal), normalize(vView)));
  float fresnel = pow(1.0 - facing, 2.6);

  // Faint horizontal scan lines crawling over the body.
  float lines = sin(vHeight * 60.0 - uTime * 3.0) * 0.5 + 0.5;

  // Normal-blended, not additive: the cat needs mass. An additive shell over a
  // bright wireframe tree has nothing to occlude, so it blew out into a
  // featureless blob under bloom. A dark body that covers what is behind it,
  // with the rim carrying the light, is what makes the silhouette read.
  vec3 color = mix(uColor, uRim, fresnel * fresnel);
  color += lines * 0.03;

  float alpha = (0.78 + fresnel * 0.22) * uOpacity;
  if (alpha < 0.004) discard;

  gl_FragColor = vec4(color, alpha);

  #include <fog_fragment>
}
`
