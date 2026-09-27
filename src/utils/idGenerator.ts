/**
 * Canonical ID / UUID Generator.
 * Re-exports standard UUID v4 generation from uuid.ts for compatibility across all imports.
 */
import { generateUuid } from './uuid';

export { generateUuid };
export const generateId = generateUuid;
export const idGenerator = generateUuid;
export default generateUuid;
