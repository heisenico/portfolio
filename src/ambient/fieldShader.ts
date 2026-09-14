export const vertexShader = /* glsl */ `
  void main() { gl_Position = vec4(position, 1.0); }
`;

export const fragmentShader = /* glsl */ `
  precision highp float;
  uniform vec2 uRes;
  uniform vec2 uAnchor;    // 0..1, origin top-left
  uniform vec2 uPointer;   // -1..1 offset, eased
  uniform float uBreath;   // 0..1
  uniform float uTime;
  uniform vec3 uGlow;      // xy: 0..1 pos, z: strength

  const vec3 PAPER  = vec3(0.953, 0.949, 0.949); // #f3f2f2
  const vec3 LB     = vec3(0.153, 0.263, 0.788); // #2743c9
  const vec3 LB500  = vec3(0.310, 0.420, 0.878); // #4f6be0
  const vec3 LB300  = vec3(0.690, 0.749, 1.000); // #b0bfff

  float blob(vec2 uv, vec2 c, float r) {
    float d = length((uv - c) * vec2(uRes.x / uRes.y, 1.0));
    return smoothstep(r, 0.0, d);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uRes;
    uv.y = 1.0 - uv.y;
    vec2 drift = 0.015 * vec2(sin(uTime * 0.11), cos(uTime * 0.07));
    vec2 a = uAnchor + drift + uPointer * 0.02;
    float scale = 1.0 + uBreath * 0.08;

    vec3 col = PAPER;
    col = mix(col, LB,    0.55 * blob(uv, a,                      0.42 * scale));
    col = mix(col, LB500, 0.45 * blob(uv, a + vec2(-0.12, -0.10), 0.30 * scale));
    col = mix(col, LB300, 0.60 * blob(uv, a + vec2(0.08, 0.08),   0.50 * scale));
    col = mix(col, LB300, uGlow.z * blob(uv, uGlow.xy, 0.10));
    gl_FragColor = vec4(col, 1.0);
  }
`;
