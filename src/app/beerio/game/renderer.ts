import { BOOST_FRACTIONS, BOOST_LANES, ROAD_HALF_WIDTH, TRACK_LENGTH, TRACK_POINTS, trackPose, type Vec3 } from './track';
import type { GamePlayer, RaceState } from './simulation';

type Color = [number, number, number];
type Mesh = { buffer: WebGLBuffer; count: number };
type Camera = { eye: Vec3; target: Vec3 };
const SKY: Color = [0.66, 0.72, 0.83];
const IDENTITY = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

export function parseColor(hex: string): Color {
  const expanded = /^#[\da-f]{3}$/i.test(hex) ? hex.slice(1).split('').map((c) => c + c).join('') : hex.replace('#', '');
  if (!/^[\da-f]{6}$/i.test(expanded)) return [0.96, 0.63, 0.24];
  return [parseInt(expanded.slice(0, 2), 16) / 255, parseInt(expanded.slice(2, 4), 16) / 255, parseInt(expanded.slice(4, 6), 16) / 255];
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(...v) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}
function cross(a: Vec3, b: Vec3): Vec3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function subtract(a: Vec3, b: Vec3): Vec3 { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
function dot(a: Vec3, b: Vec3): number { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
function multiply(a: Float32Array, b: Float32Array): Float32Array {
  const out = new Float32Array(16);
  for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
    out[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1] + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3];
  }
  return out;
}
function viewProjection(camera: Camera, aspect: number, boost: boolean): Float32Array {
  const z = normalize(subtract(camera.eye, camera.target));
  const x = normalize(cross([0, 1, 0], z)), y = cross(z, x);
  const view = new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, camera.eye), -dot(y, camera.eye), -dot(z, camera.eye), 1]);
  const f = 1 / Math.tan((boost ? 67 : 62) * Math.PI / 360), near = 0.15, far = 900;
  const projection = new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0]);
  return multiply(projection, view);
}
function model(position: Vec3, yaw = 0): Float32Array {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return new Float32Array([c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, position[0], position[1], position[2], 1]);
}

class Geometry {
  data: number[] = [];
  triangle(a: Vec3, b: Vec3, c: Vec3, color: Color, glow = false) {
    const normal = normalize(cross(subtract(b, a), subtract(c, a)));
    const light = glow ? 1 : 0.66 + Math.max(0, dot(normal, [0.32, 0.87, -0.37])) * 0.34;
    for (const point of [a, b, c]) this.data.push(...point, color[0] * light, color[1] * light, color[2] * light);
  }
  quad(a: Vec3, b: Vec3, c: Vec3, d: Vec3, color: Color, glow = false) {
    this.triangle(a, b, c, color, glow); this.triangle(a, c, d, color, glow);
  }
  box(center: Vec3, size: Vec3, color: Color, yaw = 0) {
    const p = (x: number, y: number, z: number): Vec3 => [center[0] + (x * Math.cos(yaw) + z * Math.sin(yaw)) * 0.5, center[1] + y * 0.5, center[2] + (z * Math.cos(yaw) - x * Math.sin(yaw)) * 0.5];
    const [x, y, z] = size;
    const a = p(-x, -y, -z), b = p(x, -y, -z), c = p(x, y, -z), d = p(-x, y, -z);
    const e = p(-x, -y, z), f = p(x, -y, z), g = p(x, y, z), h = p(-x, y, z);
    this.quad(a, d, c, b, color); this.quad(e, f, g, h, color);
    this.quad(a, e, h, d, color); this.quad(b, c, g, f, color);
    this.quad(d, h, g, c, color); this.quad(a, b, f, e, color);
  }
  cylinder(center: Vec3, radius: number, height: number, color: Color, sides = 8, topRadius = radius) {
    for (let i = 0; i < sides; i++) {
      const a = i / sides * Math.PI * 2, b = (i + 1) / sides * Math.PI * 2;
      const p1: Vec3 = [center[0] + Math.sin(a) * radius, center[1], center[2] + Math.cos(a) * radius];
      const p2: Vec3 = [center[0] + Math.sin(b) * radius, center[1], center[2] + Math.cos(b) * radius];
      const p3: Vec3 = [center[0] + Math.sin(b) * topRadius, center[1] + height, center[2] + Math.cos(b) * topRadius];
      const p4: Vec3 = [center[0] + Math.sin(a) * topRadius, center[1] + height, center[2] + Math.cos(a) * topRadius];
      this.quad(p1, p4, p3, p2, color);
      this.triangle([center[0], center[1] + height, center[2]], p3, p4, color);
    }
  }
  sphere(center: Vec3, radius: number, color: Color, slices = 10, rings = 6, glow = false) {
    for (let r = 0; r < rings; r++) for (let s = 0; s < slices; s++) {
      const p = (ring: number, slice: number): Vec3 => {
        const a = ring / rings * Math.PI, b = slice / slices * Math.PI * 2;
        return [center[0] + Math.sin(a) * Math.cos(b) * radius, center[1] + Math.cos(a) * radius, center[2] + Math.sin(a) * Math.sin(b) * radius];
      };
      this.quad(p(r, s), p(r + 1, s), p(r + 1, s + 1), p(r, s + 1), color, glow);
    }
  }
  roadStrip(from: number, to: number, left: number, right: number, color: Color, y = 0.04, glow = false) {
    this.quad(trackPose(from, left, y).position, trackPose(to, left, y).position, trackPose(to, right, y).position, trackPose(from, right, y).position, color, glow);
  }
}

function worldGeometry(): Geometry {
  const g = new Geometry();
  g.quad([-1500, -0.15, -1500], [-1500, -0.15, 1500], [1500, -0.15, 1500], [1500, -0.15, -1500], [0.72, 0.66, 0.51]);
  const dark: Color = [0.22, 0.25, 0.34], cream: Color = [0.99, 0.91, 0.69], orange: Color = [1, 0.43, 0.27];
  for (let i = 0; i < TRACK_POINTS.length - 1; i++) {
    const a = TRACK_POINTS[i].distance, b = TRACK_POINTS[i + 1].distance;
    g.roadStrip(a, b, -11.2, 11.2, [0.46, 0.55, 0.42], 0);
    g.roadStrip(a, b, -ROAD_HALF_WIDTH, ROAD_HALF_WIDTH, dark, 0.035);
    const curb = Math.floor(i / 3) % 2 === 0 ? cream : orange;
    g.roadStrip(a, b, -7.7, -7, curb, 0.07); g.roadStrip(a, b, 7, 7.7, curb, 0.07);
    if (i % 10 < 4) g.roadStrip(a, b, -0.07, 0.07, [0.48, 0.49, 0.55], 0.05);
    if (i % 4 === 0) {
      const next = TRACK_POINTS[Math.min(TRACK_POINTS.length - 1, i + 4)].distance;
      for (const side of [-1, 1]) {
        const pose = trackPose((a + next) / 2, side * 10.6, 0.55);
        g.box(pose.position, [0.55, 1.05, next - a + 0.2], i % 12 === 0 ? orange : cream, pose.yaw);
      }
    }
  }
  BOOST_FRACTIONS.forEach((fraction, i) => {
    const distance = fraction * TRACK_LENGTH, lane = BOOST_LANES[i];
    g.roadStrip(distance - 4, distance + 4, lane - 1.8, lane + 1.8, [0.04, 0.63, 0.65], 0.09, true);
    for (let stripe = -3; stripe <= 3; stripe += 2) {
      const a = trackPose(distance + stripe, lane - 1.3, 0.1).position;
      const b = trackPose(distance + stripe + 0.9, lane, 0.1).position;
      const c = trackPose(distance + stripe, lane + 1.3, 0.1).position;
      const d = trackPose(distance + stripe - 0.7, lane, 0.1).position;
      g.triangle(a, b, d, [0.46, 1, 0.87], true); g.triangle(b, c, d, [0.46, 1, 0.87], true);
    }
  });
  for (let row = 0; row < 4; row++) for (let column = 0; column < 14; column++) {
    g.roadStrip(row * 0.7, (row + 1) * 0.7, column - 7, column - 6, (row + column) % 2 === 0 ? cream : [0.12, 0.14, 0.21], 0.08);
  }
  const gate = trackPose(1.3);
  for (const side of [-1, 1]) g.box(trackPose(1.3, side * 9, 4.4).position, [0.9, 8.8, 1], orange, gate.yaw);
  g.box(trackPose(1.3, 0, 8.4).position, [19, 1.4, 1], [0.2, 0.2, 0.32], gate.yaw);
  for (let i = -4; i <= 4; i++) g.box(trackPose(1.3, i * 1.9, 8.4).position, [0.9, 0.7, 1.03], i % 2 ? cream : orange, gate.yaw);

  let seed = 487;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  // Purpose-built low-poly desert scenery, with no downloaded assets.
  for (let i = 0; i < 70; i++) {
    const at = random() * TRACK_LENGTH, side = random() > 0.5 ? 1 : -1;
    const pose = trackPose(at, side * (16 + random() * 19));
    const [x, , z] = pose.position;
    const height = 3 + random() * 5;
    if (i % 3 === 0) {
      g.cylinder([x, 0, z], 1.7 + random(), height * 0.55, [0.68, 0.43, 0.36], 6, 1.2);
      g.cylinder([x, height * 0.55, z], 1.25, height * 0.4, [0.8, 0.52, 0.39], 6, 0.9);
    } else {
      g.cylinder([x, 0, z], 0.45, height, [0.2, 0.43, 0.34], 6);
      g.box([x + 0.9, height * 0.52, z], [1.8, 0.5, 0.55], [0.23, 0.48, 0.35]);
      g.cylinder([x + 1.7, height * 0.52, z], 0.29, height * 0.28, [0.23, 0.48, 0.35], 6);
      g.box([x - 0.6, height * 0.72, z], [1.3, 0.48, 0.5], [0.28, 0.53, 0.37]);
      g.cylinder([x - 1.2, height * 0.72, z], 0.26, height * 0.2, [0.28, 0.53, 0.37], 6);
    }
  }
  for (let i = 0; i < 28; i++) {
    const angle = i / 28 * Math.PI * 2;
    const radius = 330 + random() * 100;
    g.cylinder([Math.sin(angle) * radius, -1, Math.cos(angle) * radius], 35 + random() * 35, 40 + random() * 70, [0.55 + random() * 0.12, 0.44, 0.48], 6, 12 + random() * 16);
  }
  // Sculptural trackside flags make turns visible from the chase cameras.
  for (let i = 0; i < 18; i++) {
    const pose = trackPose(i / 18 * TRACK_LENGTH, 13.5);
    g.cylinder(pose.position, 0.12, 6, [0.35, 0.32, 0.3], 5);
    g.box([pose.position[0], 5.25, pose.position[2]], [0.15, 1.4, 2.4], i % 2 ? [0.28, 0.74, 0.71] : [0.95, 0.61, 0.27], pose.yaw);
  }
  return g;
}

function kartGeometry(color: Color): Geometry {
  const g = new Geometry();
  const black: Color = [0.08, 0.1, 0.15], silver: Color = [0.66, 0.69, 0.73];
  g.box([0, 0.48, 0], [1.55, 0.38, 2.6], color);
  g.box([0, 0.76, 0.68], [1.36, 0.32, 1.05], color);
  g.box([0, 0.67, -0.94], [1.6, 0.45, 0.6], color);
  g.box([0, 0.41, 1.45], [1.75, 0.18, 0.23], silver);
  g.box([0, 0.48, -1.45], [1.75, 0.16, 0.25], black);
  // Raised spoiler and two mounting struts.
  for (const side of [-1, 1]) {
    g.box([side * 0.48, 1.07, -1.08], [0.14, 0.66, 0.14], black);
    for (const z of [-0.88, 0.88]) {
      g.box([side * 0.89, 0.4, z], [0.5, 0.67, 0.72], black);
      g.box([side * 1.151, 0.4, z], [0.025, 0.28, 0.32], silver);
    }
    g.box([side * 0.47, 0.8, 1.21], [0.3, 0.1, 0.03], [1, 0.92, 0.58]);
    g.box([side * 0.55, 0.76, -1.25], [0.28, 0.16, 0.03], [1, 0.2, 0.1]);
  }
  g.box([0, 1.39, -1.1], [1.9, 0.13, 0.43], color);
  g.box([0, 0.87, -0.22], [0.73, 0.6, 0.62], black);
  g.box([0, 1.19, -0.1], [0.62, 0.6, 0.62], color);
  g.sphere([0, 1.83, -0.04], 0.48, [0.99, 0.92, 0.75]);
  g.box([0, 1.83, 0.38], [0.64, 0.24, 0.1], [0.1, 0.14, 0.22]);
  g.box([0, 2.23, -0.04], [0.14, 0.09, 0.44], color);
  g.box([0, 1.23, 0.5], [0.62, 0.12, 0.15], black);
  return g;
}

function boostGeometry(): Geometry {
  const g = new Geometry();
  g.triangle([-0.5, 0.35, -1.4], [0.5, 0.35, -1.4], [0, 0.35, -4.3], [0.24, 0.96, 0.96], true);
  g.triangle([-0.3, 0.55, -1.4], [0.3, 0.55, -1.4], [0, 0.55, -3.5], [0.9, 1, 0.65], true);
  return g;
}

export class RaceRenderer {
  private gl: WebGLRenderingContext;
  private program: WebGLProgram;
  private position: number;
  private color: number;
  private viewUniform: WebGLUniformLocation;
  private modelUniform: WebGLUniformLocation;
  private eyeUniform: WebGLUniformLocation;
  private world: Mesh;
  private boost: Mesh;
  private karts: Mesh[];
  private cameras: Camera[];
  private columns: number;
  private rows: number;
  private width = 0;
  private height = 0;

  constructor(private canvas: HTMLCanvasElement, players: GamePlayer[], race: RaceState) {
    const gl = canvas.getContext('webgl', { antialias: players.length <= 4, alpha: false, powerPreference: 'high-performance' });
    if (!gl) throw new Error('WebGL is unavailable. Enable hardware acceleration in your browser, then reload the race.');
    this.gl = gl;
    const vertex = this.shader(gl.VERTEX_SHADER, `
      attribute vec3 a_position; attribute vec3 a_color;
      uniform mat4 u_view; uniform mat4 u_model; uniform vec3 u_eye;
      varying vec3 v_color; varying float v_distance;
      void main() { vec4 world = u_model * vec4(a_position, 1.0); gl_Position = u_view * world; v_color = a_color; v_distance = distance(world.xyz, u_eye); }
    `);
    const fragment = this.shader(gl.FRAGMENT_SHADER, `
      precision mediump float; varying vec3 v_color; varying float v_distance;
      void main() { float fog = smoothstep(120.0, 650.0, v_distance); gl_FragColor = vec4(mix(v_color, vec3(0.66, 0.72, 0.83), fog), 1.0); }
    `);
    const program = gl.createProgram();
    if (!program) throw new Error('Could not initialize the 3D race renderer.');
    gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
    gl.deleteShader(vertex); gl.deleteShader(fragment);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); throw new Error('Your browser could not start the 3D race renderer.'); }
    this.program = program;
    this.position = gl.getAttribLocation(program, 'a_position'); this.color = gl.getAttribLocation(program, 'a_color');
    this.viewUniform = gl.getUniformLocation(program, 'u_view')!;
    this.modelUniform = gl.getUniformLocation(program, 'u_model')!;
    this.eyeUniform = gl.getUniformLocation(program, 'u_eye')!;
    this.world = this.upload(worldGeometry()); this.boost = this.upload(boostGeometry());
    this.karts = players.map((player) => this.upload(kartGeometry(parseColor(player.color))));
    this.columns = players.length <= 1 ? 1 : players.length <= 4 ? 2 : 3;
    this.rows = Math.ceil(players.length / this.columns);
    this.cameras = race.karts.map((kart) => ({ eye: trackPose(kart.distance - 10, kart.lane * 0.6, 5.4).position, target: trackPose(kart.distance + 14, kart.lane * 0.35, 0.8).position }));
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.SCISSOR_TEST);
    gl.useProgram(program); gl.enableVertexAttribArray(this.position); gl.enableVertexAttribArray(this.color);
  }

  private shader(type: number, source: string): WebGLShader {
    const gl = this.gl, shader = gl.createShader(type);
    if (!shader) throw new Error('Could not initialize WebGL.');
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error('Your browser does not support this 3D renderer.'); }
    return shader;
  }
  private upload(geometry: Geometry): Mesh {
    const gl = this.gl, buffer = gl.createBuffer();
    if (!buffer) throw new Error('Not enough graphics memory to start the race.');
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(geometry.data), gl.STATIC_DRAW);
    return { buffer, count: geometry.data.length / 6 };
  }
  private draw(mesh: Mesh, transform: Float32Array = IDENTITY) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, mesh.buffer);
    gl.vertexAttribPointer(this.position, 3, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(this.color, 3, gl.FLOAT, false, 24, 12);
    gl.uniformMatrix4fv(this.modelUniform, false, transform); gl.drawArrays(gl.TRIANGLES, 0, mesh.count);
  }
  render(race: RaceState, dt: number) {
    const gl = this.gl;
    const rect = this.canvas.getBoundingClientRect();
    const pixelRatio = Math.min(window.devicePixelRatio || 1, race.karts.length > 4 ? 1.25 : 1.75, Math.sqrt(3400000 / Math.max(1, rect.width * rect.height)));
    const width = Math.max(1, Math.round(rect.width * pixelRatio)), height = Math.max(1, Math.round(rect.height * pixelRatio));
    if (width !== this.width || height !== this.height) {
      this.canvas.width = width; this.canvas.height = height; this.width = width; this.height = height;
    }
    gl.scissor(0, 0, width, height); gl.clearColor(0.07, 0.08, 0.12, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    for (let i = 0; i < race.karts.length; i++) {
      const kart = race.karts[i], camera = this.cameras[i];
      const position = trackPose(kart.distance, kart.lane).position;
      const behind = trackPose(kart.distance - 9 - kart.speed * 0.06, kart.lane * 0.72, 5.6).position;
      const target = trackPose(kart.distance + 13 + kart.speed * 0.1, kart.lane * 0.4, 0.85).position;
      const smoothing = Math.min(1, dt * 8);
      for (let axis = 0; axis < 3; axis++) { camera.eye[axis] += (behind[axis] - camera.eye[axis]) * smoothing; camera.target[axis] += (target[axis] - camera.target[axis]) * smoothing; }
      // Keep the chased kart in view through the tightest bends.
      camera.target[0] = camera.target[0] * 0.98 + position[0] * 0.02;
      camera.target[2] = camera.target[2] * 0.98 + position[2] * 0.02;
      const column = i % this.columns, row = Math.floor(i / this.columns);
      const x = Math.round(column * width / this.columns) + 1, right = Math.round((column + 1) * width / this.columns) - 1;
      const top = Math.round(row * height / this.rows) + 1, bottom = Math.round((row + 1) * height / this.rows) - 1;
      const w = Math.max(1, right - x), h = Math.max(1, bottom - top), y = height - bottom;
      gl.viewport(x, y, w, h); gl.scissor(x, y, w, h); gl.clearColor(...SKY, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.uniformMatrix4fv(this.viewUniform, false, viewProjection(camera, w / h, kart.boost > 0));
      gl.uniform3fv(this.eyeUniform, camera.eye);
      this.draw(this.world);
      for (let j = 0; j < race.karts.length; j++) {
        const other = race.karts[j], pose = trackPose(other.distance, other.lane, 0.04);
        const yaw = pose.yaw + Math.atan2(other.lateral, Math.max(8, other.speed)) * 0.65;
        const transform = model(pose.position, yaw);
        this.draw(this.karts[j], transform);
        if (other.boost > 0) this.draw(this.boost, transform);
      }
    }
  }
  dispose() {
    const gl = this.gl;
    for (const mesh of [this.world, this.boost, ...this.karts]) gl.deleteBuffer(mesh.buffer);
    gl.deleteProgram(this.program);
  }
}
