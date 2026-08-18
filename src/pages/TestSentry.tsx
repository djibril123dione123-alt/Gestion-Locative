import { useEffect } from 'react';

export function TestSentry() {
    useEffect(() => {
        const error = new Error("Sentry Test Error from Samay Keur Frontend");
        // We throw asynchronously so it bypasses react error boundaries and hits global sentry handler directly
        // or we can just throw here and let ErrorBoundary catch it and report it to Sentry
        throw error;
    }, []);

    return (
        <div className="p-8 text-center">
            <h1>Test Sentry</h1>
            <p>Génération d'une erreur contrôlée...</p>
        </div>
    );
}
