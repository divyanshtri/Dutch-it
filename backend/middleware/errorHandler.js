// Catches anything passed to next(err), or unhandled exceptions thrown from route handlers.
// Guarantees internal stack traces, file paths, or DB errors are never leaked to clients.
function errorHandler(err, req, res, next) {
  console.error(err); // Full error details logged strictly server-side

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: statusCode === 500 ? 'Something went wrong. Please try again.' : err.message,
  });
}

module.exports = errorHandler;