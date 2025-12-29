import { defineConfig } from '@hey-api/openapi-ts';

export default defineConfig({
    input: 'https://voxora-api.onrender.com/api/v1/openapi.json',
    output: 'src/client',
    plugins: [{
        name: '@hey-api/client-fetch',
        runtimeConfigPath: './src/lib/apiClient.ts',
    }],
});
