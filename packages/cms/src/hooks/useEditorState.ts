import type { ApiResponse, } from '@sitesurge/types';
import { createSignal, } from 'solid-js';

/**
 * Extract a human message from anything a failed call can throw/return:
 * a plain string, an `Error`, or an `ApiResponse` envelope. Single source
 * of truth for `showError`, `getErrorMessage`, and toast catch blocks.
 */
export function toErrorMessage(err: unknown, fallback = 'An error occurred',): string {
    if (typeof err === 'string') return err || fallback;
    if (err instanceof Error) return err.message || fallback;
    return (err as ApiResponse<unknown> | undefined)?.error?.message || fallback;
}

/**
 * Shared editor state hook for admin edit pages.
 * Provides consistent error/success/saving state management.
 */
export function useEditorState() {
    const [error, setError,] = createSignal('',);
    const [success, setSuccess,] = createSignal('',);
    const [saving, setSaving,] = createSignal(false,);

    const clearMessages = () => {
        setError('',);
        setSuccess('',);
    };

    /** Start a save operation — clears messages and sets saving=true */
    const beginSave = () => {
        clearMessages();
        setSaving(true,);
    };

    /** Complete a save operation — sets saving=false */
    const endSave = () => {
        setSaving(false,);
    };

    /** Set error from a string or an ApiResponse */
    const showError = (
        errOrResponse: string | ApiResponse<unknown> | Error | unknown,
        fallback = 'An error occurred',
    ) => {
        setError(toErrorMessage(errOrResponse, fallback,),);
    };

    const showSuccess = (message: string,) => {
        setSuccess(message,);
    };

    return {
        error,
        success,
        saving,
        setError,
        setSuccess,
        setSaving,
        clearMessages,
        beginSave,
        endSave,
        showError,
        showSuccess,
    };
}

/**
 * Extract an error message from a failed API response.
 * Returns the provided fallback if no message is found.
 */
export function getErrorMessage(
    response: ApiResponse<unknown> | unknown,
    fallback = 'An error occurred',
): string {
    return toErrorMessage(response, fallback,);
}
