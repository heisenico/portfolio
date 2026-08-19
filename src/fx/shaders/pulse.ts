/**
 * Wavefront shell.
 *
 * A plain translucent sphere reads as a ball. Weighting it by fresnel — bright
 * where the surface turns away from the viewer, transparent where it faces
 * straight on — leaves only the rim, which is what makes it read as a thin
 * shell sweeping outward.
 */

export const pulseVertex = /* glsl */ `
varying vec3 vNormal;
varying vec3 vView;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vNormal = normalize(mat3(modelMatrix) * normal);
  vView = normalize(cameraPosition - worldPosition.xyz);
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

export const pulseFragment = /* glsl */ `
uniform vec3 uColor;
uniform float uOpacity;
uniform float uTime;

varying vec3 vNormal;
varying vec3 vView;

void main() {
  if (uOpacity <= 0.001) discard;

  float facing = abs(dot(normalize(vNormal), normalize(vView)));

  // Thin rim: bright only where the shell is nearly edge-on to the viewer.
  // A low exponent leaves a broad wash that reads as a filled bubble rather
  // than a shell, so this is deliberately steep.
  float rim = pow(1.0 - facing, 9.0);

  // Fine banding across the shell, so it reads as a scanned surface rather
  // than a soap bubble.
  float bands = sin(vNormal.y * 42.0 + uTime * 5.0) * 0.5 + 0.5;
  rim *= 0.72 + bands * 0.28;

  float alpha = rim * uOpacity;
  if (alpha < 0.002) discard;

  gl_FragColor = vec4(uColor * alpha * 1.9, alpha);
}
`
