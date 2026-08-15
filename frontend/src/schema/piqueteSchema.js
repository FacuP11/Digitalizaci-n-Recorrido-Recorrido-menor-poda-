import { z } from 'zod';

export const piqueteSchema = z.object({
  numeroPiquete: z
    .number({ invalid_type_error: "El número de piquete debe ser un valor numérico" })
    .positive("El número de piquete debe ser mayor a 0"),

  lineaId: z
    .string()
    .min(1, "Debe seleccionar la línea de alta tensión"),

  estadoAisladores: z.enum(['BUENO', 'REGULAR', 'CRITICO'], {
    errorMap: () => ({ message: "El estado del aislador debe ser BUENO, REGULAR o CRITICO" })
  }),

  nivelPodaRequerido: z
    .number()
    .min(0, "Mínimo nivel de poda es 0")
    .max(3, "Máximo nivel de poda es 3"),

  observaciones: z
    .string()
    .max(500, "Las observaciones no pueden superar los 500 caracteres")
    .optional()
});

export default piqueteSchema;