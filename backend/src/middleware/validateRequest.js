/**
 * Generic request validation utility
 * @param {Function} validatorFn - Function taking req and returning { isValid, errors }
 */
export function validateRequest(validatorFn) {
  return (req, res, next) => {
    const { isValid, errors, message } = validatorFn(req);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: message || 'Invalid request parameters',
        data: null,
        errors: Array.isArray(errors) ? errors : [errors],
      });
    }
    next();
  };
}
