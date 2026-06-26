const noop = () => {};
const identity = () => ({});
const mat4 = {
	fromValues: (...v) => ({ 0: v[0], 1: v[1], 2: v[2], 3: v[3], 4: v[4], 5: v[5], 6: v[6], 7: v[7], 8: v[8], 9: v[9], 10: v[10], 11: v[11], 12: v[12], 13: v[13], 14: v[14], 15: v[15], length: 16 }),
	clone: (m) => ({ ...m, transpose() { return this; } }),
	create: () => ({}),
	identity: () => ({}),
	transpose: (m) => m,
	multiply: noop,
	multiplyScalar: noop,
	translate: noop,
	scale: noop,
	rotate: noop,
	perspective: noop,
	ortho: noop,
	invert: noop,
};
const vec = { fromValues: (...v) => v, create: () => [], clone: (v) => [...v], add: noop, subtract: noop, scale: noop, multiply: noop, normalize: noop, lerp: noop, dot: () => 0, length: () => 0, cross: noop, transformMat4: noop };

export const Mat4 = mat4;
export const Vec2 = vec;
export const Vec3 = vec;
export const Vec4 = vec;

export const Application = function () {
	return { destroy: noop, stage: { addChild: noop, removeChildren: noop }, ticker: { add: noop, remove: noop, destroy: noop } };
};
export const Texture = function () { return {}; };
export const Container = function () {
	return { addChild: noop, removeChildren: noop, removeChild: noop, destroy: noop, position: { set: noop }, scale: { set: noop }, alpha: 1 };
};
export const BlurFilter = function () { return { blur: 0, destroy: noop }; };
export const BulgePinchFilter = function () { return { destroy: noop }; };
export const ColorMatrixFilter = function () { return { destroy: noop, matrix: [] }; };
export const Sprite = function () {
	return { destroy: noop, anchor: { set: noop }, position: { set: noop }, scale: { set: noop }, texture: {} };
};
export default {};
