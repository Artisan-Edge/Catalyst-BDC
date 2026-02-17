import { z } from 'zod';

export interface OAuthConfig {
    clientId: string;
    clientSecret: string;
    authorizationUrl: string;
    tokenUrl: string;
}

export interface TokenConfig {
    accessToken: string;
    refreshToken: string;
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
    expiresAfter?: number;
}

export interface BdcConfig {
    host: string;
    space: string;
    verbose?: boolean;
    oauth: OAuthConfig | { optionsFile: string };
    tokens?: TokenConfig;
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
    oauth: oauthConfigSchema,
    tokens: z.object({
        accessToken: z.string().min(1),
        refreshToken: z.string().min(1),
        tokenUrl: z.string().url(),
        clientId: z.string().min(1),
        clientSecret: z.string().min(1),
        expiresAfter: z.number().optional(),
    }).optional(),
});
