export function errorHandler(err, req, res, next) {
  console.error('[Server Error]:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Error interno del servidor';

  res.status(statusCode).json({
    status: 'error',
    mensaje: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
}