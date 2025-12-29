import type { CreateClientConfig } from '@/client/client.gen';

export const createClientConfig: CreateClientConfig = (config) => {
    // Use different URLs for server-side vs client-side
    const isServer = typeof window === 'undefined';
    let baseUrl: string;

    if (isServer) {
        // for server-side rendering, use the Render API URL
        baseUrl = process.env.BACKEND_URL || 'https://voxora-api.onrender.com';
    } else {
        // for client-side, use the Render API URL
        baseUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://voxora-api.onrender.com';
    }

    return {
        ...config,
        baseUrl,
    };
};
