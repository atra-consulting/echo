// Error body of the REST API: {"error": {"code", "message", "details"?}}.
import { Response } from 'express';
import * as z from 'zod/v4';

export interface ApiError {
    error: { code: string; message: string; details?: unknown };
}

export function apiError(code: string, message: string, details?: unknown): ApiError {
    return { error: details === undefined ? { code, message } : { code, message, details } };
}

// Validates the input; on failure answers 400 and returns undefined. Only
// paths and messages go into the answer, the issues never echo the input.
export function parse<T>(schema: z.ZodType<T>, input: unknown, res: Response): T | undefined {
    const result = schema.safeParse(input ?? {});
    if (!result.success) {
        const issues = result.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message }));
        res.status(400).json(apiError('invalid_request', 'Die Anfrage ist ungültig.', issues));
        return undefined;
    }
    return result.data;
}
