/**
 * Edge API Endpoint: /api/admin/students
 * 
 * Re-exports the onRequest handler from /api/coach/students.js
 * to serve admin requests for student physical measurement updates.
 */

import { onRequest as coachStudentsHandler } from '../coach/students.js';

export async function onRequest(context) {
  return coachStudentsHandler(context);
}
