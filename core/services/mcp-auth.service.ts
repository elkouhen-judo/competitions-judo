import type { JudokaRow } from "../repositories/types";
import type { Judoka, McpAuthorizationCodeClaims, McpScope, McpTokenClaims } from "../types";
import { toCanonicalJudoka } from "./domain-adapters";

type McpTokenPayload = Pick<McpTokenClaims, "sub" | "email" | "role" | "scopes">;
type McpCodePayload = Pick<
  McpAuthorizationCodeClaims,
  "email" | "role" | "scopes" | "clientId" | "redirectUri" | "codeChallenge"
>;
type McpCaller = JudokaRow & { judokaId?: string };

export interface IssueAuthorizationCodeParams {
  email: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
}

export interface McpAuthServiceDeps {
  userContextService: {
    getCurrentUser(email: string): Promise<McpCaller | null>;
  };
  isCoach: (user: Judoka) => boolean;
  isAdmin: (user: Judoka) => boolean;
  signMcpToken: (claims: McpTokenPayload) => string | McpTokenPayload;
  signAuthorizationCode: (claims: McpCodePayload) => string | McpCodePayload;
}

export interface McpAuthService {
  issueTokenForUser(email: string): Promise<string | McpTokenPayload>;
  issueAuthorizationCode(
    params: IssueAuthorizationCodeParams
  ): Promise<string | McpCodePayload>;
}

function createCoachScopes(): McpScope[] {
  return [
    "judokas:read",
    "competitions:read",
    "competitions:write",
    "combats:read",
    "combats:write",
    "coach-dashboard:read"
  ];
}

function createAdminScopes(): McpScope[] {
  return ["access:read"];
}

/**
 * Scopes for an authenticated caller who is neither COACH nor ADMIN (a plain
 * JUDOKA or PARENT). Limited to their own perimeter by the application
 * services backing each MCP tool.
 */
function createNormalScopes(): McpScope[] {
  return ["judokas:read", "competitions:read", "competitions:write", "combats:read", "combats:write"];
}

async function resolveAuthorizedCaller(
  userContextService: McpAuthServiceDeps["userContextService"],
  isCoach: McpAuthServiceDeps["isCoach"],
  isAdmin: McpAuthServiceDeps["isAdmin"],
  email: string
) {
  const currentUser = await userContextService.getCurrentUser(email);
  if (!currentUser) {
    throw new Error("Utilisateur introuvable.");
  }

  const canonicalUser = toCanonicalJudoka(currentUser);
  const scopes = isCoach(canonicalUser)
    ? createCoachScopes()
    : isAdmin(canonicalUser)
      ? createAdminScopes()
      : createNormalScopes();

  return { canonicalUser, scopes };
}

export default function createMcpAuthService({
  userContextService,
  isCoach,
  isAdmin,
  signMcpToken,
  signAuthorizationCode
}: McpAuthServiceDeps): McpAuthService {
  async function issueTokenForUser(email: string) {
    const { canonicalUser, scopes } = await resolveAuthorizedCaller(
      userContextService,
      isCoach,
      isAdmin,
      email
    );

    return signMcpToken({
      sub: canonicalUser.judokaId,
      email: canonicalUser.accountEmail || email,
      role: canonicalUser.accessRole,
      scopes
    });
  }

  async function issueAuthorizationCode({
    email,
    clientId,
    redirectUri,
    codeChallenge
  }: IssueAuthorizationCodeParams) {
    const { canonicalUser, scopes } = await resolveAuthorizedCaller(
      userContextService,
      isCoach,
      isAdmin,
      email
    );

    return signAuthorizationCode({
      email: canonicalUser.accountEmail || email,
      role: canonicalUser.accessRole,
      scopes,
      clientId,
      redirectUri,
      codeChallenge
    });
  }

  return {
    issueTokenForUser,
    issueAuthorizationCode
  };
}
