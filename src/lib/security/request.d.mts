export class PayloadTooLargeError extends Error {
  readonly code: "PAYLOAD_TOO_LARGE";
}

export function readJsonBody(request: Request, maxBytes: number): Promise<unknown>;
