export const errorMiddleware = (error, req, res, next) => {
  const statusCode = error.statusCode || 500;

  if (process.env.NODE_ENV !== "production") {
    console.error("Error:", error);
  }

  return res.status(statusCode).json({
    success: false,
    message: error.message || "Internal server error",
    stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
  });
};
