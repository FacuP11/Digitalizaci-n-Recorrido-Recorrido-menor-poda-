export const validarSchema = (schema) => (req, res, next) => {
  // safeParse evalúa los datos sin lanzar excepciones bruscas
  const resultado = schema.safeParse(req.body);

  if (!resultado.success) {
    // Extraemos los errores para devolverlos al cliente
    const errores = resultado.error.issues.map((issue) => ({
      campo: issue.path.join('.'),
      mensaje: issue.message
    }));

    return res.status(400).json({
      status: 'error',
      mensaje: 'Error de validación de datos',
      errores
    });
  }

  // Si los datos son válidos, reemplazamos req.body con los datos limpios y seguimos al controlador
  req.body = resultado.data;
  next();
};