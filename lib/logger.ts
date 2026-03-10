const isDev = process.env.NODE_ENV === 'development';

export const log = {
    error: (...args: unknown[]) => {
        if (isDev) console.error(...args);
    },
    warn: (...args: unknown[]) => {
        if (isDev) console.warn(...args);
    },
    info: (...args: unknown[]) => {
        if (isDev) console.info(...args);
    },
};
