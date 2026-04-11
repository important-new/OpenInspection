/** Returns an error message if the password fails complexity rules, or null if valid. */
export function validatePasswordStrength(password: string): string | null {
    if (password.length < 8) return 'Password must be at least 8 characters.';
    if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter.';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one digit.';
    if (!/[^A-Za-z0-9]/.test(password)) return 'Password must contain at least one special character.';
    return null;
}
