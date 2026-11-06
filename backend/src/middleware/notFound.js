/**
 * 404 Route Not Found Middleware
 */
export function notFound(req, res, next) {
  const error = new Error(`Resource endpoint not found: ${req.method} ${req.originalUrl}`);
  res.status(404);
  next(error);
}
