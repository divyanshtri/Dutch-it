// Validates either req.body (default) or req.params, replacing it with parsed data
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return res.status(400).json({
        message: 'Invalid input.',
        errors: result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      });
    }
    req[source] = result.data;
    next();
  };
}

module.exports = validate;