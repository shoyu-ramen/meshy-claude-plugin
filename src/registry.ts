// Single source of truth: task_type → API base path.
// GET <base>/:id retrieves, GET <base> lists, DELETE <base>/:id deletes, POST <base> creates.

const CREATIVE_LAB_PRODUCTS = [
  "keychain",
  "fridge-magnet",
  "figure",
  "vinyl-figure",
  "brick-figure",
  "lamp",
  "keycap",
] as const;

export type CreativeLabProduct = (typeof CREATIVE_LAB_PRODUCTS)[number];
export const CREATIVE_LAB_PRODUCT_VALUES = [...CREATIVE_LAB_PRODUCTS] as [
  CreativeLabProduct,
  ...CreativeLabProduct[],
];

const CORE_ENDPOINTS = {
  "text-to-3d": "/openapi/v2/text-to-3d",
  "image-to-3d": "/openapi/v1/image-to-3d",
  "multi-image-to-3d": "/openapi/v1/multi-image-to-3d",
  remesh: "/openapi/v1/remesh",
  convert: "/openapi/v1/convert",
  resize: "/openapi/v1/resize",
  "uv-unwrap": "/openapi/v1/uv-unwrap",
  retexture: "/openapi/v1/retexture",
  rigging: "/openapi/v1/rigging",
  animation: "/openapi/v1/animations",
  "text-to-image": "/openapi/v1/text-to-image",
  "image-to-image": "/openapi/v1/image-to-image",
  "multi-color-print": "/openapi/v1/print/multi-color",
  "analyze-printability": "/openapi/v1/print/analyze",
  "repair-printability": "/openapi/v1/print/repair",
} as const;

function creativeLabEndpoints(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const product of CREATIVE_LAB_PRODUCTS) {
    out[`${product}-prototype`] = `/openapi/creative-lab/${product}/v1/prototype`;
    out[`${product}-build`] = `/openapi/creative-lab/${product}/v1/build`;
  }
  return out;
}

export const TASK_ENDPOINTS: Record<string, string> = {
  ...CORE_ENDPOINTS,
  ...creativeLabEndpoints(),
};

export type TaskType = keyof typeof CORE_ENDPOINTS | `${CreativeLabProduct}-${"prototype" | "build"}`;

export const TASK_TYPE_VALUES = Object.keys(TASK_ENDPOINTS) as [TaskType, ...TaskType[]];

export function endpointFor(taskType: TaskType): string {
  const base = TASK_ENDPOINTS[taskType];
  if (!base) {
    throw new Error(`Unknown task_type "${taskType}". Valid: ${TASK_TYPE_VALUES.join(", ")}`);
  }
  return base;
}
