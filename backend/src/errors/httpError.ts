export interface HttpErrorLike extends Error {
  status: number;
}

export class HttpError extends Error implements HttpErrorLike {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

export function isHttpError(err: unknown): err is HttpErrorLike {
  return err instanceof HttpError || (
    err instanceof Error && typeof (err as HttpErrorLike).status === "number"
  );
}
