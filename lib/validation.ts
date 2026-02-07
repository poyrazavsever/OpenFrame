/**
 * Validates that a URL uses only safe schemes (http/https)
 * Prevents javascript:, data:, and other potentially dangerous URI schemes
 */
export function isValidHttpUrl(urlString: string): boolean {
    try {
        const url = new URL(urlString);
        return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
        return false;
    }
}

/**
 * Validates a URL and returns an error message if invalid
 */
export function validateUrl(urlString: string, fieldName: string = 'URL'): string | null {
    if (!urlString || typeof urlString !== 'string') {
        return `${fieldName} is required`;
    }

    if (!isValidHttpUrl(urlString)) {
        return `${fieldName} must be a valid HTTP or HTTPS URL`;
    }

    return null;
}

/**
 * Validates an optional URL - returns null if empty/undefined, error if invalid
 */
export function validateOptionalUrl(urlString: string | null | undefined, fieldName: string = 'URL'): string | null {
    if (!urlString) {
        return null; // Optional URLs can be empty
    }

    return validateUrl(urlString, fieldName);
}
