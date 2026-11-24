// Query options of the /dwaas-core/api/v1/spaces/{space}/<type> endpoints, named as in the tenant's
// discovery document (the OpenAPI document SAP's datasphere CLI builds its commands from)

export interface DeleteOptions {
    // Delete even when other objects depend on the object; false lets Datasphere refuse
    deleteAnyway?: boolean;
}

export interface ObjectWriteOptions {
    // Deploy after saving (default true, the discovery document's default)
    deploy?: boolean;
    // Save despite validation messages (default false)
    saveAnyway?: boolean;
    // Save although objects it depends on are missing (default false)
    allowMissingDependencies?: boolean;
}

export interface ListOptions {
    // Only these technical names
    technicalNames?: string[];
    // One page of at most this many; without it every page is read
    top?: number;
    skip?: number;
}
