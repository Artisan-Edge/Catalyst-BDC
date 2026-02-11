import { z } from 'zod';

export interface OAuthConfig {
    clientId: string;
    clientSecret: string;
    authorizationUrl: string;
    tokenUrl: string;
}

export interface BdcConfig {
    host: string;
    space: string;
    verbose?: boolean;
    oauth?: OAuthConfig | { optionsFile: string };
}

export const oauthConfigSchema = z.union([
    z.object({
        clientId: z.string().min(1),
        clientSecret: z.string().min(1),
        authorizationUrl: z.string().url(),
        tokenUrl: z.string().url(),
    }),
    z.object({
        optionsFile: z.string().min(1),
    }),
]);

export const bdcConfigSchema = z.object({
    host: z.string().url(),
    space: z.string().min(1),
    verbose: z.boolean().optional(),
    oauth: oauthConfigSchema.optional(),
});
