function serializeError(error) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: process.env.NODE_ENV === "production" ? undefined : error.stack,
    };
  }

  return { message: String(error) };
}

function write(level, event, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    service: "ozlind-api",
    level,
    event,
    ...fields,
  };

  const output = JSON.stringify(entry);
  if (level === "error") console.error(output);
  else if (level === "warn") console.warn(output);
  else console.log(output);
}

export const logger = Object.freeze({
  info(event, fields) {
    write("info", event, fields);
  },
  warn(event, fields) {
    write("warn", event, fields);
  },
  error(event, error, fields = {}) {
    write("error", event, {
      ...fields,
      error: serializeError(error),
    });
  },
});
